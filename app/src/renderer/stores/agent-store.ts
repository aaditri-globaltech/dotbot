/**
 * Session store for the renderer workbench.
 *
 * Main-process manager events are the source of truth; this store only
 * decorates them with renderer-owned state such as unread markers, drafts, and
 * the current transcript.
 */

import type {
  AgentChatItem,
  AgentCommand,
  AgentEvent,
  AgentFeedbackResponse,
  AgentManagerEvent,
  AgentSessionSummary,
  AgentStreamingBehavior,
} from "@dotbot/agent-core";
import { create } from "zustand";
import { api } from "../api";
import {
  applySessionEvent,
  applySessionState,
  createSessionClientState,
  type SessionClientState,
} from "../components/panels/agent-session-state";
import { useWorkspaceStore } from "./workspace-store";

/** Preserve event order while coalescing streamed events and history chunks. */
type PendingStateUpdate =
  | { kind: "event"; event: AgentEvent }
  | { kind: "history"; items: AgentChatItem[] };

type AgentStore = {
  sessions: AgentSessionSummary[];
  tabs: string[];
  selectedId?: string;
  states: Record<string, SessionClientState>;
  /** New-task template state, present until its first keystroke starts a session. */
  template?: SessionClientState;
  subscribe: () => () => void;
  loadSessions: () => Promise<void>;
  selectSession: (id?: string) => void;
  openSession: (id: string) => void;
  closeTab: (id: string) => void;
  /** Open the new-task template; picks a project when none is given. */
  startNewTask: (projectDir?: string) => Promise<void>;
  /** Pick a project directory and make it the current project. */
  pickProject: () => Promise<string | undefined>;
  prompt: (message: string, streamingBehavior?: AgentStreamingBehavior) => void;
  abort: () => void;
  command: (command: AgentCommand) => void;
  respond: (response: AgentFeedbackResponse) => void;
  setDraft: (value: string) => void;
};

function reportError(error: unknown) {
  console.error(error);
}

function sameSummary(
  left: AgentSessionSummary,
  right: AgentSessionSummary,
): boolean {
  return (
    left.cwd === right.cwd &&
    left.title === right.title &&
    left.name === right.name &&
    left.status === right.status &&
    left.active === right.active &&
    left.waiting === right.waiting &&
    left.unread === right.unread
  );
}

/** Agent sessions, transcripts, and controls for every open tab. */
export const useAgentStore = create<AgentStore>((set, get) => {
  const pendingStateEvents = new Map<string, PendingStateUpdate[]>();
  let stateFlushScheduled = false;
  let templateSeq = 0;
  let templateCreation: Promise<string> | undefined;
  // Sessions created by the template that have not been prompted yet.
  const unprompted = new Set<string>();

  const flushStateEvents = () => {
    stateFlushScheduled = false;
    if (pendingStateEvents.size === 0) return;

    const pending = new Map(pendingStateEvents);
    pendingStateEvents.clear();
    // History arrives in small chunks; apply each session's batch once per frame.
    const nextStates: Record<string, SessionClientState> = {};
    for (const [id, updates] of pending) {
      let state = get().states[id] ?? createSessionClientState();
      let history: AgentChatItem[] = [];
      const flushHistory = () => {
        if (history.length === 0) return;
        state = { ...state, messages: [...state.messages, ...history] };
        history = [];
      };

      for (const update of updates) {
        if (update.kind === "history") {
          history.push(...update.items);
          continue;
        }
        flushHistory();
        state = applySessionEvent(state, update.event);
      }
      flushHistory();
      nextStates[id] = state;
    }

    set((current) => ({ states: { ...current.states, ...nextStates } }));
  };

  const scheduleStateFlush = () => {
    if (stateFlushScheduled) return;

    stateFlushScheduled = true;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(flushStateEvents);
    } else {
      queueMicrotask(flushStateEvents);
    }
  };

  const queueStateEvent = (id: string, event: AgentEvent) => {
    const updates = pendingStateEvents.get(id) ?? [];
    updates.push({ kind: "event", event });
    pendingStateEvents.set(id, updates);
    scheduleStateFlush();
  };

  const queueHistory = (id: string, items: AgentChatItem[]) => {
    const updates = pendingStateEvents.get(id) ?? [];
    updates.push({ kind: "history", items });
    pendingStateEvents.set(id, updates);
    scheduleStateFlush();
  };

  const updateSession = (session: AgentSessionSummary) => {
    set((current) => {
      const entry = current.sessions.find(
        (candidate) => candidate.id === session.id,
      );
      if (!entry) return { sessions: [...current.sessions, session] };

      const next = { ...session, unread: entry.unread || session.unread };
      if (sameSummary(entry, next)) return current;
      return {
        sessions: current.sessions.map((candidate) =>
          candidate.id === session.id ? next : candidate,
        ),
      };
    });
  };

  const handleEvent = (event: AgentManagerEvent) => {
    // Main-process events are the source of truth; client state only decorates them.
    if (event.type === "sessions") {
      set((current) => {
        const unread = new Map(
          current.sessions.map((session) => [session.id, session.unread]),
        );
        return {
          sessions: event.sessions.map((session) => ({
            ...session,
            unread: unread.get(session.id) ?? false,
          })),
        };
      });
      return;
    }

    if (event.type === "session_update") {
      updateSession(event.session);
      return;
    }

    if (event.type === "session_state") {
      set((current) => {
        const state =
          current.states[event.sessionId] ?? createSessionClientState();
        return {
          states: {
            ...current.states,
            [event.sessionId]: applySessionState(state, event.state),
          },
        };
      });
      return;
    }

    if (event.type === "session_history") {
      queueHistory(event.sessionId, event.items);
      return;
    }

    if (event.type === "feedback_request") {
      set((current) => ({
        sessions: current.sessions.map((session) =>
          session.id === event.sessionId
            ? {
                ...session,
                waiting: event.request,
                status: "waiting",
                active: true,
              }
            : session,
        ),
      }));
      return;
    }

    if (event.type === "session_event") {
      queueStateEvent(event.sessionId, event.event);
      if (event.sessionId !== get().selectedId) {
        set((current) => ({
          sessions: current.sessions.map((session) =>
            session.id === event.sessionId && !session.unread
              ? { ...session, unread: true }
              : session,
          ),
        }));
      }
    }
  };

  const selectSession = (id?: string) => {
    set((current) => ({
      template: undefined,
      selectedId: id,
      sessions: id
        ? current.sessions.map((session) =>
            session.id === id ? { ...session, unread: false } : session,
          )
        : current.sessions,
      states:
        id && !current.states[id]
          ? { ...current.states, [id]: createSessionClientState() }
          : current.states,
    }));
  };

  const openSession = (id: string) => {
    const session = get().sessions.find((entry) => entry.id === id);
    if (!session) return;

    set((current) => ({
      tabs: current.tabs.includes(id) ? current.tabs : [...current.tabs, id],
    }));
    selectSession(id);

    if (!session.active) {
      // Reopening a disposed session reloads its transcript from the agent.
      set((current) => {
        const state = current.states[id] ?? createSessionClientState();
        return {
          states: {
            ...current.states,
            [id]: { ...state, messages: [] },
          },
        };
      });
      // Opening starts the agent session in the main process.
      void api.agent.open(id).catch(reportError);
    }
  };

  const closeTab = (id: string) => {
    const current = get();
    const index = current.tabs.indexOf(id);
    const next = current.tabs.filter((tabId) => tabId !== id);
    if (unprompted.has(id)) {
      discardSession(id);
    } else {
      void api.agent.close(id).catch(reportError);
      set({ tabs: next });
    }
    if (current.selectedId !== id) return;

    const replacement = next[index] ?? next[index - 1];
    selectSession(replacement);
  };

  const updateSelectedState = (
    update: (state: SessionClientState) => SessionClientState,
  ) => {
    const id = get().selectedId;
    if (!id) return;
    set((current) => ({
      states: {
        ...current.states,
        [id]: update(current.states[id] ?? createSessionClientState()),
      },
    }));
  };

  /** Drop an unprompted session from the manager and every renderer list. */
  const discardSession = (id: string) => {
    unprompted.delete(id);
    void api.agent.remove(id).catch(reportError);
    set((current) => {
      const states = { ...current.states };
      delete states[id];
      return {
        sessions: current.sessions.filter((session) => session.id !== id),
        tabs: current.tabs.filter((tabId) => tabId !== id),
        states,
        ...(current.selectedId === id ? { selectedId: undefined } : {}),
      };
    });
  };

  const sendPrompt = (
    id: string,
    message: string,
    streamingBehavior?: AgentStreamingBehavior,
  ) => {
    unprompted.delete(id);
    // Optimistically render the user's message while the agent streams its response.
    set((current) => {
      const state = current.states[id] ?? createSessionClientState();
      return {
        states: {
          ...current.states,
          [id]: {
            ...state,
            draft: "",
            messages: [
              ...state.messages,
              { id: crypto.randomUUID(), role: "user", text: message },
            ],
          },
        },
      };
    });
    void api.agent.prompt(id, message, streamingBehavior).catch(reportError);
  };

  /**
   * Start the template's session on its first keystroke. A template abandoned or
   * replaced before the session opens has that session discarded.
   */
  const ensureTemplateSession = (): Promise<string> | undefined => {
    if (templateCreation) return templateCreation;
    const projectDir = useWorkspaceStore.getState().selectedProject;
    if (!get().template || !projectDir) return undefined;

    const seq = templateSeq;
    const creation = (async () => {
      const session = await api.agent.create(projectDir);
      updateSession(session);
      unprompted.add(session.id);
      const discard = () => {
        discardSession(session.id);
        return session.id;
      };

      if (!get().template || templateSeq !== seq) return discard();

      // Open first so the manager keeps the session, then apply the template
      // choices before publishing it as the selected session.
      await api.agent.open(session.id);
      const stillActive = get().template;
      if (!stillActive || templateSeq !== seq) return discard();

      const separator = stillActive.selectedModel.indexOf("/");
      if (separator !== -1) {
        await api.agent.command(session.id, {
          type: "set_model",
          provider: stillActive.selectedModel.slice(0, separator),
          modelId: stillActive.selectedModel.slice(separator + 1),
        });
      }
      await api.agent.command(session.id, {
        type: "set_thinking_level",
        level: stillActive.thinkingLevel,
      });
      const latest = get().template;
      if (!latest || templateSeq !== seq) return discard();

      // Hand the template's draft to the session the composer now shows.
      set((current) => ({
        states: {
          ...current.states,
          [session.id]: {
            ...(current.states[session.id] ?? createSessionClientState()),
            draft: latest.draft,
          },
        },
      }));
      openSession(session.id);
      return session.id;
    })();
    templateCreation = creation;
    const clear = () => {
      if (templateCreation === creation) templateCreation = undefined;
    };
    void creation.then(clear, clear);
    return creation;
  };

  const pickProject = async (): Promise<string | undefined> => {
    try {
      const projectDir = await api.projects.pick();
      if (projectDir) useWorkspaceStore.getState().selectProject(projectDir);
      return projectDir;
    } catch (error) {
      reportError(error);
      return undefined;
    }
  };

  const startNewTask = async (projectDir?: string) => {
    let target = projectDir ?? useWorkspaceStore.getState().selectedProject;
    if (!target) {
      target = await pickProject();
      if (!target) return;
    }

    useWorkspaceStore.getState().selectProject(target);
    templateSeq += 1;
    templateCreation = undefined;
    const seq = templateSeq;
    set({ template: createSessionClientState(), selectedId: undefined });
    useWorkspaceStore.getState().setScreen("workbench");

    try {
      const defaults = await api.agent.defaults({ cwd: target });
      if (templateSeq !== seq) return;
      set((current) =>
        current.template
          ? { template: applySessionState(current.template, defaults) }
          : current,
      );
    } catch (error) {
      reportError(error);
    }
  };

  const command = (command: AgentCommand) => {
    const template = get().template;
    if (template) {
      if (command.type === "set_thinking_level") {
        set({ template: { ...template, thinkingLevel: command.level } });
        return;
      }

      set({
        template: {
          ...template,
          selectedModel: `${command.provider}/${command.modelId}`,
        },
      });
      const projectDir = useWorkspaceStore.getState().selectedProject;
      if (!projectDir) return;
      // Previewing another model also changes the supported thinking levels.
      void api.agent
        .defaults({
          cwd: projectDir,
          provider: command.provider,
          modelId: command.modelId,
        })
        .then((next) => {
          set((current) => {
            if (!current.template) return current;
            const applied = applySessionState(current.template, next);
            return {
              template: {
                ...applied,
                thinkingLevel: applied.thinkingLevels.includes(
                  current.template.thinkingLevel,
                )
                  ? current.template.thinkingLevel
                  : applied.thinkingLevel,
              },
            };
          });
        })
        .catch(reportError);
      return;
    }

    const id = get().selectedId;
    if (id) void api.agent.command(id, command).catch(reportError);
  };

  return {
    sessions: [],
    tabs: [],
    selectedId: undefined,
    states: {},
    template: undefined,

    subscribe: () => api.agent.onEvent(handleEvent),

    loadSessions: async () => {
      set({ sessions: await api.agent.list() });
    },

    selectSession,

    openSession,

    closeTab,

    startNewTask,

    pickProject,

    prompt: (message, streamingBehavior) => {
      if (get().template) {
        const pending = ensureTemplateSession();
        if (pending) {
          void pending
            .then((id) => sendPrompt(id, message, streamingBehavior))
            .catch(reportError);
        }
        return;
      }
      const id = get().selectedId;
      if (!id) return;
      sendPrompt(id, message, streamingBehavior);
    },

    abort: () => {
      const id = get().selectedId;
      if (id) void api.agent.abort(id).catch(reportError);
    },

    command,

    respond: (response) => {
      const id = get().selectedId;
      if (id) void api.agent.respond(id, response).catch(reportError);
    },

    setDraft: (value) => {
      const template = get().template;
      if (template) {
        set({ template: { ...template, draft: value } });
        if (value) {
          const pending = ensureTemplateSession();
          if (pending) void pending.catch(reportError);
        }
        return;
      }
      updateSelectedState((state) => ({ ...state, draft: value }));
    },
  };
});
