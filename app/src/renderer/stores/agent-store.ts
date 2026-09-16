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
  subscribe: () => () => void;
  loadSessions: () => Promise<void>;
  selectSession: (id?: string) => void;
  openSession: (id: string) => void;
  closeTab: (id: string) => void;
  createSession: (cwd: string) => Promise<void>;
  pickWorkspaceAndCreateSession: () => Promise<void>;
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
    useWorkspaceStore.getState().rememberWorkspace(session.cwd);
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
      const workspace = useWorkspaceStore.getState();
      for (const session of event.sessions)
        workspace.rememberWorkspace(session.cwd);
      if (event.sessions[0]) {
        workspace.selectInitialWorkspace(event.sessions[0].cwd);
      }
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
    void api.agent.close(id).catch(reportError);
    const current = get();
    const index = current.tabs.indexOf(id);
    const next = current.tabs.filter((tabId) => tabId !== id);
    set({ tabs: next });
    if (current.selectedId !== id) return;

    const replacement = next[index] ?? next[index - 1];
    selectSession(replacement);
  };

  const createSession = async (cwd: string) => {
    try {
      useWorkspaceStore.getState().selectWorkspace(cwd);
      const session = await api.agent.create(cwd);
      updateSession(session);
      openSession(session.id);
    } catch (error) {
      reportError(error);
    }
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

  return {
    sessions: [],
    tabs: [],
    selectedId: undefined,
    states: {},

    subscribe: () => api.agent.onEvent(handleEvent),

    loadSessions: async () => {
      const next = await api.agent.list();
      set({ sessions: next });
      const workspace = useWorkspaceStore.getState();
      for (const session of next) workspace.rememberWorkspace(session.cwd);
      if (next[0]) workspace.selectInitialWorkspace(next[0].cwd);
    },

    selectSession,

    openSession,

    closeTab,

    createSession,

    pickWorkspaceAndCreateSession: async () => {
      try {
        const cwd = await api.workspace.pick();
        if (cwd) await createSession(cwd);
      } catch (error) {
        reportError(error);
      }
    },

    prompt: (message, streamingBehavior) => {
      // Optimistically render the user's message while the agent streams its response.
      const id = get().selectedId;
      if (!id) return;
      updateSelectedState((state) => ({
        ...state,
        draft: "",
        messages: [
          ...state.messages,
          { id: crypto.randomUUID(), role: "user", text: message },
        ],
      }));
      void api.agent.prompt(id, message, streamingBehavior).catch(reportError);
    },

    abort: () => {
      const id = get().selectedId;
      if (id) void api.agent.abort(id).catch(reportError);
    },

    command: (command) => {
      const id = get().selectedId;
      if (id) void api.agent.command(id, command).catch(reportError);
    },

    respond: (response) => {
      const id = get().selectedId;
      if (id) void api.agent.respond(id, response).catch(reportError);
    },

    setDraft: (value) => {
      updateSelectedState((state) => ({ ...state, draft: value }));
    },
  };
});
