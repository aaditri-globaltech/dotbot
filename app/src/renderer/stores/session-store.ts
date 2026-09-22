/**
 * Session store for the renderer workbench.
 *
 * Main-process manager events are the source of truth; this store only
 * decorates them with renderer-owned state such as unread markers, drafts, and
 * the current transcript.
 */

import type {
  AgentManagerEvent,
  AgentSessionEvent,
  BashExecution,
  ExtensionResponse,
  ModelThinkingLevel,
  SessionSummary,
  StreamingBehavior,
  TranscriptItem,
} from "@dotbot/agent-core";
import { create } from "zustand";
import { api } from "../api";
import {
  applySessionActivity,
  applySessionControls,
  applySessionError,
  createSessionClientState,
  isBashExecution,
  type SessionClientState,
} from "../components/panels/session-state";
import { useNavigationStore } from "./navigation-store";
import { useWorkspaceStore } from "./workspace-store";

/** Preserve event order while coalescing streamed events and transcript chunks. */
type PendingStateUpdate =
  | { kind: "activity"; event: AgentSessionEvent }
  | { kind: "error"; message: string }
  | { kind: "transcript"; items: TranscriptItem[] };

type SessionStore = {
  sessions: SessionSummary[];
  tabs: string[];
  selectedId?: string;
  states: Record<string, SessionClientState>;
  /** New session draft state, present until its first keystroke starts a session. */
  newSession?: SessionClientState;
  subscribe: () => () => void;
  loadSessions: () => Promise<void>;
  selectSession: (id?: string) => void;
  openSession: (id: string) => void;
  closeTab: (id: string) => void;
  /** Open a new session draft; picks a project when none is given. */
  startNewSession: (projectDir?: string) => Promise<void>;
  /** Pick a project directory and make it the current project. */
  pickProject: () => Promise<string | undefined>;
  prompt: (message: string, streamingBehavior?: StreamingBehavior) => void;
  /** Run a bash command in the selected session. */
  runBash: (command: string, excludeFromContext: boolean) => void;
  abort: () => void;
  setModel: (provider: string, modelId: string) => void;
  setThinkingLevel: (level: ModelThinkingLevel) => void;
  respond: (response: ExtensionResponse) => void;
  setDraft: (value: string) => void;
};

function reportError(error: unknown) {
  console.error(error);
}

function sameSummary(left: SessionSummary, right: SessionSummary): boolean {
  return (
    left.projectDir === right.projectDir &&
    left.title === right.title &&
    left.name === right.name &&
    left.status === right.status &&
    left.active === right.active &&
    left.waiting === right.waiting &&
    left.unread === right.unread
  );
}

/** Agent sessions, transcripts, and controls for every open tab. */
export const useSessionStore = create<SessionStore>((set, get) => {
  const pendingStateEvents = new Map<string, PendingStateUpdate[]>();
  let stateFlushScheduled = false;
  let newSessionSeq = 0;
  let newSessionCreation: Promise<string> | undefined;
  // Sessions created by the new session draft that have not been prompted yet.
  const unprompted = new Set<string>();

  const flushStateEvents = () => {
    stateFlushScheduled = false;
    if (pendingStateEvents.size === 0) return;

    const pending = new Map(pendingStateEvents);
    pendingStateEvents.clear();
    // Transcript chunks arrive in small pieces; apply each session's batch once per frame.
    const nextStates: Record<string, SessionClientState> = {};
    for (const [id, updates] of pending) {
      let state = get().states[id] ?? createSessionClientState();
      let transcript: TranscriptItem[] = [];
      const flushTranscript = () => {
        if (transcript.length === 0) return;
        state = { ...state, transcript: [...state.transcript, ...transcript] };
        transcript = [];
      };

      for (const update of updates) {
        if (update.kind === "transcript") {
          transcript.push(...update.items);
          continue;
        }
        flushTranscript();
        if (update.kind === "error") {
          state = applySessionError(state, update.message);
          continue;
        }
        state = applySessionActivity(state, update.event);
      }
      flushTranscript();
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

  const queueStateUpdate = (id: string, update: PendingStateUpdate) => {
    const updates = pendingStateEvents.get(id) ?? [];
    updates.push(update);
    pendingStateEvents.set(id, updates);
    scheduleStateFlush();
  };

  const updateSession = (session: SessionSummary) => {
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
    if (event.type === "session_update") {
      updateSession(event.session);
      return;
    }

    if (event.type === "session_controls") {
      set((current) => {
        const state =
          current.states[event.sessionId] ?? createSessionClientState();
        return {
          states: {
            ...current.states,
            [event.sessionId]: applySessionControls(state, event.controls),
          },
        };
      });
      return;
    }

    if (event.type === "session_transcript") {
      queueStateUpdate(event.sessionId, {
        kind: "transcript",
        items: event.items,
      });
      return;
    }

    if (event.type === "extension_request") {
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

    if (event.type === "session_activity") {
      queueStateUpdate(event.sessionId, {
        kind: "activity",
        event: event.event,
      });
      if (event.sessionId !== get().selectedId) {
        set((current) => ({
          sessions: current.sessions.map((session) =>
            session.id === event.sessionId && !session.unread
              ? { ...session, unread: true }
              : session,
          ),
        }));
      }
      return;
    }

    if (event.type === "session_error") {
      queueStateUpdate(event.sessionId, {
        kind: "error",
        message: event.message,
      });
    }
  };

  const selectSession = (id?: string) => {
    set((current) => ({
      newSession: undefined,
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
            [id]: { ...state, transcript: [] },
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

  /** Drop an unprompted session from the manager and every renderer list. */
  const discardSession = (id: string) => {
    unprompted.delete(id);
    void api.agent.discard(id).catch(reportError);
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
    streamingBehavior?: StreamingBehavior,
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
            transcript: [
              ...state.transcript,
              { id: crypto.randomUUID(), role: "user", text: message },
            ],
          },
        },
      };
    });
    void api.agent.prompt(id, message, streamingBehavior).catch(reportError);
  };

  /**
   * Append a running bash card, execute the command, and finalize the card with
   * the command result. Output deltas arrive through `bash_execution_update`
   * events.
   */
  const runBashOn = (
    id: string,
    command: string,
    excludeFromContext: boolean,
  ) => {
    if (get().states[id]?.activeBash) return;
    // A run started during a turn parks in the pending strip while it executes;
    // an idle run enters the transcript directly.
    const streaming =
      get().sessions.find((session) => session.id === id)?.status === "running";
    const bashId = `bash-${crypto.randomUUID()}`;
    unprompted.delete(id);
    set((current) => ({
      states: {
        ...current.states,
        [id]: {
          ...(current.states[id] ?? createSessionClientState()),
          draft: "",
          activeBash: { id: bashId, pending: streaming },
          transcript: [
            ...(current.states[id]?.transcript ?? []),
            {
              kind: "bash",
              id: bashId,
              command,
              excludeFromContext,
              output: "",
              truncated: false,
              status: "running",
            },
          ],
        },
      },
    }));

    const finishBash = (update: (item: BashExecution) => BashExecution) => {
      set((current) => {
        const existing = current.states[id];
        if (!existing) return current;
        return {
          states: {
            ...current.states,
            [id]: {
              ...existing,
              // A later command may have replaced this one by the time it settles.
              ...(existing.activeBash?.id === bashId
                ? { activeBash: undefined }
                : {}),
              transcript: existing.transcript.map((item) =>
                isBashExecution(item) && item.id === bashId
                  ? update(item)
                  : item,
              ),
            },
          },
        };
      });
    };

    void api.agent
      .executeBash(id, command, { excludeFromContext, id: bashId })
      .then((result) =>
        finishBash((item) => ({
          ...item,
          output: result.output,
          truncated: result.truncated,
          ...(result.fullOutputPath !== undefined
            ? { fullOutputPath: result.fullOutputPath }
            : {}),
          ...(result.exitCode !== undefined
            ? { exitCode: result.exitCode }
            : {}),
          status: result.cancelled
            ? "cancelled"
            : result.exitCode === 0
              ? "done"
              : "error",
        })),
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        finishBash((item) => ({
          ...item,
          output: message,
          status: "error",
        }));
        reportError(error);
      });
  };

  /**
   * Start the new session on its first keystroke. A draft abandoned or
   * replaced before the session opens has that session discarded.
   */
  const ensureNewSession = (): Promise<string> | undefined => {
    if (newSessionCreation) return newSessionCreation;
    const projectDir = useWorkspaceStore.getState().selectedProject;
    if (!get().newSession || !projectDir) return undefined;

    const seq = newSessionSeq;
    const creation = (async () => {
      const session = await api.agent.create(projectDir);
      updateSession(session);
      unprompted.add(session.id);
      const discard = () => {
        discardSession(session.id);
        return session.id;
      };

      if (!get().newSession || newSessionSeq !== seq) return discard();

      // Open first so the manager keeps the session, then apply the new session
      // choices before publishing it as the selected session.
      await api.agent.open(session.id);
      const stillActive = get().newSession;
      if (!stillActive || newSessionSeq !== seq) return discard();

      const separator = stillActive.selectedModel.indexOf("/");
      if (separator !== -1) {
        await api.agent.setModel(
          session.id,
          stillActive.selectedModel.slice(0, separator),
          stillActive.selectedModel.slice(separator + 1),
        );
      }
      await api.agent.setThinkingLevel(session.id, stillActive.thinkingLevel);
      const latest = get().newSession;
      if (!latest || newSessionSeq !== seq) return discard();

      // Hand the new session draft to the session the composer now shows.
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
    newSessionCreation = creation;
    const clear = () => {
      if (newSessionCreation === creation) newSessionCreation = undefined;
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

  const startNewSession = async (projectDir?: string) => {
    let target = projectDir ?? useWorkspaceStore.getState().selectedProject;
    if (!target) {
      target = await pickProject();
      if (!target) return;
    }

    useWorkspaceStore.getState().selectProject(target);
    newSessionSeq += 1;
    newSessionCreation = undefined;
    const seq = newSessionSeq;
    set({ newSession: createSessionClientState(), selectedId: undefined });
    useNavigationStore.getState().setScreen("workbench");

    try {
      const controls = await api.agent.controls({ projectDir: target });
      if (newSessionSeq !== seq) return;
      set((current) =>
        current.newSession
          ? { newSession: applySessionControls(current.newSession, controls) }
          : current,
      );
    } catch (error) {
      reportError(error);
    }
  };

  const setModel = (provider: string, modelId: string) => {
    const newSession = get().newSession;
    if (newSession) {
      set({
        newSession: {
          ...newSession,
          selectedModel: `${provider}/${modelId}`,
        },
      });
      const projectDir = useWorkspaceStore.getState().selectedProject;
      if (!projectDir) return;
      // Previewing another model also changes the supported thinking levels.
      void api.agent
        .controls({ projectDir, provider, modelId })
        .then((next) => {
          set((current) => {
            if (!current.newSession) return current;
            const applied = applySessionControls(current.newSession, next);
            return {
              newSession: {
                ...applied,
                thinkingLevel: applied.thinkingLevels.includes(
                  current.newSession.thinkingLevel,
                )
                  ? current.newSession.thinkingLevel
                  : applied.thinkingLevel,
              },
            };
          });
        })
        .catch(reportError);
      return;
    }

    const id = get().selectedId;
    if (id) void api.agent.setModel(id, provider, modelId).catch(reportError);
  };

  const setThinkingLevel = (level: ModelThinkingLevel) => {
    const newSession = get().newSession;
    if (newSession) {
      set({ newSession: { ...newSession, thinkingLevel: level } });
      return;
    }

    const id = get().selectedId;
    if (id) void api.agent.setThinkingLevel(id, level).catch(reportError);
  };

  /** Run an action against the selected session, creating a draft session first. */
  const withSelectedSession = (action: (id: string) => void) => {
    if (get().newSession) {
      const pending = ensureNewSession();
      if (pending) void pending.then(action).catch(reportError);
      return;
    }
    const id = get().selectedId;
    if (id) action(id);
  };

  return {
    sessions: [],
    tabs: [],
    selectedId: undefined,
    states: {},
    newSession: undefined,

    subscribe: () => api.agent.onEvent(handleEvent),

    loadSessions: async () => {
      set({ sessions: await api.agent.list() });
    },

    selectSession,

    openSession,

    closeTab,

    startNewSession,

    pickProject,

    prompt: (message, streamingBehavior) => {
      withSelectedSession((id) => sendPrompt(id, message, streamingBehavior));
    },

    runBash: (command, excludeFromContext) => {
      withSelectedSession((id) => runBashOn(id, command, excludeFromContext));
    },

    abort: () => {
      const id = get().selectedId;
      if (!id) return;
      // A running UI command takes precedence over aborting the turn.
      if (get().states[id]?.activeBash) {
        void api.agent.abortBash(id).catch(reportError);
        return;
      }
      void api.agent.abort(id).catch(reportError);
    },

    setModel,

    setThinkingLevel,

    respond: (response) => {
      const id = get().selectedId;
      if (id) void api.agent.respond(id, response).catch(reportError);
    },

    setDraft: (value) => {
      const newSession = get().newSession;
      if (newSession) {
        set({ newSession: { ...newSession, draft: value } });
        if (value) {
          const pending = ensureNewSession();
          if (pending) void pending.catch(reportError);
        }
        return;
      }

      const id = get().selectedId;
      if (!id) return;
      set((current) => ({
        states: {
          ...current.states,
          [id]: {
            ...(current.states[id] ?? createSessionClientState()),
            draft: value,
          },
        },
      }));
    },
  };
});
