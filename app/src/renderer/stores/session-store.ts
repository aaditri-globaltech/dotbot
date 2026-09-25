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
import { batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { api } from "../api";
import {
  applySessionActivity,
  applySessionControls,
  applySessionError,
  createSessionClientState,
  isBashExecution,
  parseModelKey,
  type SessionClientState,
} from "../components/panels/session-state";
import { errorMessage } from "../errors";
import { navigationStore } from "./navigation-store";
import { workspaceStore } from "./workspace-store";

/** Preserve event order while coalescing streamed events and transcript chunks. */
type PendingStateUpdate =
  | { kind: "activity"; event: AgentSessionEvent }
  | { kind: "error"; message: string }
  | { kind: "transcript"; items: TranscriptItem[] };

type SessionState = {
  sessions: SessionSummary[];
  tabs: string[];
  selectedId?: string;
  states: Record<string, SessionClientState>;
  /** New session draft state, present until its first keystroke starts a session. */
  newSession?: SessionClientState;
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
export function createSessionStore() {
  const [state, setState] = createStore<SessionState>({
    sessions: [],
    tabs: [],
    selectedId: undefined,
    states: {},
    newSession: undefined,
  });

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
      let current = state.states[id] ?? createSessionClientState();
      let transcript: TranscriptItem[] = [];
      const flushTranscript = () => {
        if (transcript.length === 0) return;
        current = {
          ...current,
          transcript: [...current.transcript, ...transcript],
        };
        transcript = [];
      };

      for (const update of updates) {
        if (update.kind === "transcript") {
          transcript.push(...update.items);
          continue;
        }
        flushTranscript();
        if (update.kind === "error") {
          current = applySessionError(current, update.message);
          continue;
        }
        current = applySessionActivity(current, update.event);
      }
      flushTranscript();
      nextStates[id] = current;
    }

    batch(() => {
      for (const [id, next] of Object.entries(nextStates)) {
        setState("states", id, next);
      }
    });
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
    const entry = state.sessions.find(
      (candidate) => candidate.id === session.id,
    );
    if (!entry) {
      setState("sessions", (sessions) => [...sessions, session]);
      return;
    }

    const next = { ...session, unread: entry.unread || session.unread };
    if (sameSummary(entry, next)) return;
    setState("sessions", (sessions) =>
      sessions.map((candidate) =>
        candidate.id === session.id ? next : candidate,
      ),
    );
  };

  const handleEvent = (event: AgentManagerEvent) => {
    // Main-process events are the source of truth; client state only decorates them.
    if (event.type === "session_update") {
      updateSession(event.session);
      return;
    }

    if (event.type === "session_controls") {
      const current =
        state.states[event.sessionId] ?? createSessionClientState();
      setState(
        "states",
        event.sessionId,
        applySessionControls(current, event.controls),
      );
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
      setState("sessions", (sessions) =>
        sessions.map((session) =>
          session.id === event.sessionId
            ? {
                ...session,
                waiting: event.request,
                status: "waiting",
                active: true,
              }
            : session,
        ),
      );
      return;
    }

    if (event.type === "session_activity") {
      queueStateUpdate(event.sessionId, {
        kind: "activity",
        event: event.event,
      });
      if (event.sessionId !== state.selectedId) {
        setState("sessions", (sessions) =>
          sessions.map((session) =>
            session.id === event.sessionId && !session.unread
              ? { ...session, unread: true }
              : session,
          ),
        );
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
    // One update: an effect that runs between these writes would see neither a
    // draft nor a selection, which unmounts the composer while the user types.
    batch(() => {
      setState("newSession", undefined);
      setState("selectedId", id);
      if (!id) return;

      if (!state.states[id]) setState("states", id, createSessionClientState());
      setState("sessions", (sessions) =>
        sessions.map((session) =>
          session.id === id ? { ...session, unread: false } : session,
        ),
      );
    });
  };

  const openSession = (id: string) => {
    const session = state.sessions.find((entry) => entry.id === id);
    if (!session) return;

    if (!state.tabs.includes(id)) setState("tabs", (tabs) => [...tabs, id]);
    selectSession(id);

    if (!session.active) {
      // Reopening a disposed session reloads its transcript from the agent.
      const current = state.states[id] ?? createSessionClientState();
      setState("states", id, { ...current, transcript: [] });
      // Opening starts the agent session in the main process.
      void api.agent.open(id).catch(reportError);
    }
  };

  const closeTab = (id: string) => {
    const index = state.tabs.indexOf(id);
    const next = state.tabs.filter((tabId) => tabId !== id);
    batch(() => {
      if (unprompted.has(id)) {
        discardSession(id);
      } else {
        void api.agent.close(id).catch(reportError);
        setState("tabs", next);
      }
      // A discarded tab clears the selection, so this also picks the neighbour.
      if (state.selectedId !== id)
        selectSession(next[index] ?? next[index - 1]);
    });
  };

  /** Drop an unprompted session from the manager and every renderer list. */
  const discardSession = (id: string) => {
    unprompted.delete(id);
    void api.agent.discard(id).catch(reportError);
    batch(() => {
      setState("sessions", (sessions) =>
        sessions.filter((session) => session.id !== id),
      );
      setState("tabs", (tabs) => tabs.filter((tabId) => tabId !== id));
      // The key has to go, not just be emptied: a stale client state would come
      // back as an empty transcript if the id were ever reused.
      setState(
        "states",
        produce((states) => {
          delete states[id];
        }),
      );
      if (state.selectedId === id) setState("selectedId", undefined);
    });
  };

  const sendPrompt = (
    id: string,
    message: string,
    streamingBehavior?: StreamingBehavior,
  ) => {
    unprompted.delete(id);
    // Optimistically render the user's message while the agent streams its response.
    const current = state.states[id] ?? createSessionClientState();
    setState("states", id, {
      ...current,
      draft: "",
      transcript: [
        ...current.transcript,
        { id: crypto.randomUUID(), role: "user", text: message },
      ],
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
    if (state.states[id]?.activeBash) return;
    // A run started during a turn parks in the pending strip while it executes;
    // an idle run enters the transcript directly.
    const streaming =
      state.sessions.find((session) => session.id === id)?.status === "running";
    const bashId = `bash-${crypto.randomUUID()}`;
    unprompted.delete(id);
    const current = state.states[id] ?? createSessionClientState();
    setState("states", id, {
      ...current,
      draft: "",
      activeBash: { id: bashId, pending: streaming },
      transcript: [
        ...current.transcript,
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
    });

    const finishBash = (update: (item: BashExecution) => BashExecution) => {
      const existing = state.states[id];
      if (!existing) return;
      // A later command may have replaced this one by the time it settles.
      if (existing.activeBash?.id === bashId) {
        setState("states", id, "activeBash", undefined);
      }
      setState(
        "states",
        id,
        "transcript",
        existing.transcript.map((item) =>
          isBashExecution(item) && item.id === bashId ? update(item) : item,
        ),
      );
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
        const message = errorMessage(error);
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
    const projectDir = workspaceStore.state.selectedProject;
    if (!state.newSession || !projectDir) return undefined;

    const seq = newSessionSeq;
    const creation = (async () => {
      const session = await api.agent.create(projectDir);
      updateSession(session);
      unprompted.add(session.id);
      const discard = () => {
        discardSession(session.id);
        return session.id;
      };

      if (!state.newSession || newSessionSeq !== seq) return discard();

      // Open first so the manager keeps the session, then apply the new session
      // choices before publishing it as the selected session.
      await api.agent.open(session.id);
      const stillActive = state.newSession;
      if (!stillActive || newSessionSeq !== seq) return discard();

      const model = parseModelKey(stillActive.selectedModel);
      if (model) {
        await api.agent.setModel(session.id, model.provider, model.modelId);
      }
      await api.agent.setThinkingLevel(session.id, stillActive.thinkingLevel);
      const latest = state.newSession;
      if (!latest || newSessionSeq !== seq) return discard();

      // Hand the new session draft to the session the composer now shows.
      const created = state.states[session.id] ?? createSessionClientState();
      setState("states", session.id, { ...created, draft: latest.draft });
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
      if (projectDir) workspaceStore.selectProject(projectDir);
      return projectDir;
    } catch (error) {
      reportError(error);
      return undefined;
    }
  };

  const startNewSession = async (projectDir?: string) => {
    let target = projectDir ?? workspaceStore.state.selectedProject;
    if (!target) {
      target = await pickProject();
      if (!target) return;
    }

    workspaceStore.selectProject(target);
    newSessionSeq += 1;
    newSessionCreation = undefined;
    const seq = newSessionSeq;
    setState({ newSession: createSessionClientState(), selectedId: undefined });
    navigationStore.setScreen("workbench");

    try {
      const controls = await api.agent.controls({ projectDir: target });
      if (newSessionSeq !== seq) return;
      if (!state.newSession) return;
      setState("newSession", applySessionControls(state.newSession, controls));
    } catch (error) {
      reportError(error);
    }
  };

  const setModel = (provider: string, modelId: string) => {
    const newSession = state.newSession;
    if (newSession) {
      setState("newSession", "selectedModel", `${provider}/${modelId}`);
      const projectDir = workspaceStore.state.selectedProject;
      if (!projectDir) return;
      // Previewing another model also changes the supported thinking levels.
      void api.agent
        .controls({ projectDir, provider, modelId })
        .then((next) => {
          const draft = state.newSession;
          if (!draft) return;
          const applied = applySessionControls(draft, next);
          setState("newSession", {
            ...applied,
            thinkingLevel: applied.thinkingLevels.includes(draft.thinkingLevel)
              ? draft.thinkingLevel
              : applied.thinkingLevel,
          });
        })
        .catch(reportError);
      return;
    }

    const id = state.selectedId;
    if (id) void api.agent.setModel(id, provider, modelId).catch(reportError);
  };

  const setThinkingLevel = (level: ModelThinkingLevel) => {
    if (state.newSession) {
      setState("newSession", "thinkingLevel", level);
      return;
    }

    const id = state.selectedId;
    if (id) void api.agent.setThinkingLevel(id, level).catch(reportError);
  };

  /** Run an action against the selected session, creating a draft session first. */
  const withSelectedSession = (action: (id: string) => void) => {
    if (state.newSession) {
      const pending = ensureNewSession();
      if (pending) void pending.then(action).catch(reportError);
      return;
    }
    const id = state.selectedId;
    if (id) action(id);
  };

  return {
    state,

    subscribe: () => api.agent.onEvent(handleEvent),

    loadSessions: async () => {
      const sessions = await api.agent.list();
      setState("sessions", sessions);
    },

    selectSession,

    openSession,

    closeTab,

    startNewSession,

    pickProject,

    prompt: (message: string, streamingBehavior?: StreamingBehavior) => {
      withSelectedSession((id) => sendPrompt(id, message, streamingBehavior));
    },

    runBash: (command: string, excludeFromContext: boolean) => {
      withSelectedSession((id) => runBashOn(id, command, excludeFromContext));
    },

    abort: () => {
      const id = state.selectedId;
      if (!id) return;
      // A running UI command takes precedence over aborting the turn.
      if (state.states[id]?.activeBash) {
        void api.agent.abortBash(id).catch(reportError);
        return;
      }
      void api.agent.abort(id).catch(reportError);
    },

    setModel,

    setThinkingLevel,

    respond: (response: ExtensionResponse) => {
      const id = state.selectedId;
      if (id) void api.agent.respond(id, response).catch(reportError);
    },

    setDraft: (value: string) => {
      if (state.newSession) {
        setState("newSession", "draft", value);
        if (value) {
          const pending = ensureNewSession();
          if (pending) void pending.catch(reportError);
        }
        return;
      }

      const id = state.selectedId;
      if (!id) return;
      const current = state.states[id] ?? createSessionClientState();
      setState("states", id, { ...current, draft: value });
    },
  };
}

/** Shared session store for the running app. */
export const sessionStore = createSessionStore();
