/**
 * The new session draft must not create a session until the user types, and
 * the workspace must never be populated from the persisted session list.
 */

import type {
  AgentManagerEvent,
  BashResult,
  ModelThinkingLevel,
  SessionControls,
  SessionSummary,
} from "@dotbot/agent-core";
import { createEffect, createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  controls: vi.fn(),
  create: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  discard: vi.fn(),
  prompt: vi.fn(),
  abort: vi.fn(),
  executeBash: vi.fn(),
  abortBash: vi.fn(),
  setModel: vi.fn(),
  setThinkingLevel: vi.fn(),
  list: vi.fn(),
  pick: vi.fn(),
  onEvent: vi.fn(),
}));

vi.mock("../src/renderer/api", () => ({
  api: {
    agent: {
      controls: mocks.controls,
      create: mocks.create,
      open: mocks.open,
      close: mocks.close,
      discard: mocks.discard,
      prompt: mocks.prompt,
      abort: mocks.abort,
      executeBash: mocks.executeBash,
      abortBash: mocks.abortBash,
      setModel: mocks.setModel,
      setThinkingLevel: mocks.setThinkingLevel,
      list: mocks.list,
      onEvent: mocks.onEvent,
    },
    projects: { pick: mocks.pick },
  },
}));

import { navigationStore } from "../src/renderer/stores/navigation-store";
import { createSessionStore } from "../src/renderer/stores/session-store";
import { workspaceStore } from "../src/renderer/stores/workspace-store";

function session(
  id: string,
  projectDir: string,
  overrides: Partial<SessionSummary> = {},
): SessionSummary {
  return {
    id,
    projectDir,
    title: id,
    status: "idle",
    active: false,
    unread: false,
    lastActivity: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A promise the test settles by hand. */
function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** A bash result, defaulted to a finished command with no output. */
function bashResult(overrides: Partial<BashResult> = {}): BashResult {
  return {
    output: "",
    exitCode: 0,
    cancelled: false,
    truncated: false,
    ...overrides,
  };
}

const controls: SessionControls = {
  models: [{ provider: "faux", id: "faux-1", name: "Faux" }],
  selectedModel: "faux/faux-1",
  thinkingLevel: "medium",
  thinkingLevels: [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
  ] as ModelThinkingLevel[],
};

let store: ReturnType<typeof createSessionStore>;

beforeEach(() => {
  store = createSessionStore();
  navigationStore.setScreen("dashboard");
  vi.clearAllMocks();
  mocks.controls.mockResolvedValue(controls);
  mocks.open.mockImplementation(async (id: string) => session(id, "/p"));
  mocks.prompt.mockResolvedValue(undefined);
  mocks.setModel.mockResolvedValue(undefined);
  mocks.setThinkingLevel.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.discard.mockResolvedValue(undefined);
  mocks.abort.mockResolvedValue(undefined);
  mocks.abortBash.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
  mocks.executeBash.mockResolvedValue(bashResult());
});

describe("session store new session", () => {
  it("creates no session until the first keystroke", async () => {
    const projectsBefore = workspaceStore.state.projects.length;

    await store.startNewSession("/p");
    expect(store.state.newSession).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    // The project is remembered for the workspace, not taken from sessions.
    expect(workspaceStore.state.projects.slice(projectsBefore)).toEqual(["/p"]);
    expect(navigationStore.state.screen).toBe("workbench");

    mocks.create.mockResolvedValue(session("s1", "/p"));
    store.setDraft("h");

    await vi.waitFor(() => expect(store.state.selectedId).toBe("s1"));
    expect(mocks.create).toHaveBeenCalledWith("/p");
    expect(store.state.newSession).toBeUndefined();
    expect(store.state.tabs).toEqual(["s1"]);
    expect(store.state.states.s1?.draft).toBe("h");
  });

  it("keeps typing that arrives while the session is being created", async () => {
    const create = defer<SessionSummary>();
    mocks.create.mockReturnValue(create.promise);

    await store.startNewSession("/p");
    store.setDraft("h");
    store.setDraft("he");
    store.setDraft("hel");
    create.resolve(session("s1", "/p"));

    await vi.waitFor(() => expect(store.state.selectedId).toBe("s1"));
    expect(store.state.states.s1?.draft).toBe("hel");
  });

  it("keeps typing that arrives while the session is starting", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    const opening = defer<SessionSummary>();
    mocks.open.mockReturnValue(opening.promise);

    await store.startNewSession("/p");
    store.setDraft("h");
    await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledWith("s1"));
    store.setDraft("hi");
    opening.resolve(session("s1", "/p"));

    await vi.waitFor(() => expect(store.state.selectedId).toBe("s1"));
    expect(store.state.states.s1?.draft).toBe("hi");
  });

  it("sends the first message through the session being created", async () => {
    const create = defer<SessionSummary>();
    mocks.create.mockReturnValue(create.promise);

    await store.startNewSession("/p");
    store.setDraft("h");
    store.prompt("hello");
    create.resolve(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(mocks.prompt).toHaveBeenCalledWith("s1", "hello", undefined),
    );
    expect(store.state.states.s1?.draft).toBe("");
    expect(store.state.states.s1?.transcript).toMatchObject([
      { role: "user", text: "hello" },
    ]);
  });

  it("removes a session whose new session was abandoned", async () => {
    const create = defer<SessionSummary>();
    mocks.create.mockReturnValue(create.promise);

    await store.startNewSession("/p");
    store.setDraft("h");
    store.selectSession("other");
    create.resolve(session("s1", "/p"));

    await vi.waitFor(() => expect(mocks.discard).toHaveBeenCalledWith("s1"));
    expect(store.state.selectedId).toBe("other");
    expect(store.state.sessions.some((entry) => entry.id === "s1")).toBe(false);
    expect(store.state.tabs).toEqual([]);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("removes an unprompted session when its tab closes", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await store.startNewSession("/p");
    store.setDraft("h");
    await vi.waitFor(() => expect(store.state.selectedId).toBe("s1"));

    store.closeTab("s1");

    await vi.waitFor(() => expect(mocks.discard).toHaveBeenCalledWith("s1"));
    expect(store.state.sessions.some((entry) => entry.id === "s1")).toBe(false);
    expect(store.state.tabs).toEqual([]);
  });

  it("closes, but keeps, a session that was prompted", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await store.startNewSession("/p");
    store.setDraft("h");
    await vi.waitFor(() => expect(store.state.selectedId).toBe("s1"));

    store.prompt("hello");
    store.closeTab("s1");

    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledWith("s1");
  });

  it("applies the new session model and thinking choices to the new session", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await store.startNewSession("/p");
    store.setThinkingLevel("high");
    store.setModel("faux", "faux-1");
    store.setDraft("h");

    await vi.waitFor(() => expect(mocks.setModel).toHaveBeenCalledTimes(1));
    expect(mocks.setModel).toHaveBeenCalledWith("s1", "faux", "faux-1");
    expect(mocks.setThinkingLevel).toHaveBeenCalledWith("s1", "high");
  });

  it("keeps persisted sessions out of the workspace projects", async () => {
    workspaceStore.selectProject("/opened");
    const projectsBefore = [...workspaceStore.state.projects];
    const selectedBefore = workspaceStore.state.selectedProject;
    mocks.list.mockResolvedValue([session("old", "/legacy")]);

    await store.loadSessions();

    expect(workspaceStore.state.projects).toEqual(projectsBefore);
    expect(workspaceStore.state.selectedProject).toBe(selectedBefore);
    expect(store.state.sessions.map((entry) => entry.id)).toEqual(["old"]);
  });

  it("keeps the store usable when listing sessions fails", async () => {
    const failure = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.list.mockRejectedValue(new Error("bridge down"));

    await expect(store.loadSessions()).rejects.toThrow("bridge down");

    expect(store.state.sessions).toEqual([]);
    failure.mockRestore();
  });

  it("coalesces streamed transcript chunks into a single state write", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    let handler: ((event: AgentManagerEvent) => void) | undefined;
    mocks.onEvent.mockImplementation(
      (value: (event: AgentManagerEvent) => void) => {
        handler = value;
        return () => {};
      },
    );
    const unsubscribe = store.subscribe();

    handler?.({
      type: "session_transcript",
      sessionId: "s1",
      items: [{ id: "t1", role: "user", text: "a" }],
    });
    handler?.({
      type: "session_transcript",
      sessionId: "s1",
      items: [{ id: "t2", role: "assistant", text: "b" }],
    });

    // Nothing lands until the frame that coalesces the burst.
    expect(store.state.states.s1?.transcript ?? []).toHaveLength(0);
    for (const frame of frames) frame(0);
    expect(store.state.states.s1?.transcript.map((item) => item.id)).toEqual([
      "t1",
      "t2",
    ]);
    unsubscribe();
    vi.unstubAllGlobals();
  });
});

/** Select a session backed by a fresh client state. */
async function openSession(
  id: string,
  status: SessionSummary["status"] = "idle",
) {
  mocks.list.mockResolvedValue([session(id, "/p", { status })]);
  await store.loadSessions();
  store.openSession(id);
}

/** Resolve a deferred bash result from a test. */
function deferBash() {
  const pending = defer<BashResult>();
  mocks.executeBash.mockReturnValue(pending.promise);
  return pending.resolve;
}

describe("session store UI bash", () => {
  it("runs a command and renders the result", async () => {
    await openSession("s1");
    mocks.executeBash.mockResolvedValue(bashResult({ output: "a.txt" }));

    store.runBash("ls", false);

    const active = store.state.states.s1?.activeBash;
    expect(active?.id).toEqual(expect.any(String));
    // An idle run enters the transcript directly, not the pending strip.
    expect(active?.pending).toBe(false);
    expect(mocks.executeBash).toHaveBeenCalledWith("s1", "ls", {
      excludeFromContext: false,
      id: active?.id,
    });
    expect(store.state.states.s1?.transcript).toMatchObject([
      {
        kind: "bash",
        id: active?.id,
        command: "ls",
        excludeFromContext: false,
        output: "",
        truncated: false,
        status: "running",
      },
    ]);

    await vi.waitFor(() =>
      expect(store.state.states.s1?.activeBash).toBeUndefined(),
    );
    expect(store.state.states.s1?.transcript).toMatchObject([
      {
        id: active?.id,
        output: "a.txt",
        truncated: false,
        exitCode: 0,
        status: "done",
      },
    ]);
  });

  it("passes the excluded-from-context flag through", async () => {
    await openSession("s1");
    store.runBash("ls", true);

    expect(mocks.executeBash).toHaveBeenCalledWith(
      "s1",
      "ls",
      expect.objectContaining({ excludeFromContext: true }),
    );
  });

  it("marks a failed command as an error", async () => {
    await openSession("s1");
    mocks.executeBash.mockResolvedValue(
      bashResult({ output: "boom", exitCode: 1 }),
    );

    store.runBash("false", false);

    await vi.waitFor(() =>
      expect(store.state.states.s1?.activeBash).toBeUndefined(),
    );
    expect(store.state.states.s1?.transcript).toMatchObject([
      { kind: "bash", output: "boom", exitCode: 1, status: "error" },
    ]);
  });

  it("moves a turn-started command into the transcript when it completes", async () => {
    await openSession("s1", "running");
    mocks.executeBash.mockResolvedValue(bashResult({ output: "a.txt" }));

    store.runBash("ls", false);

    expect(store.state.states.s1?.activeBash).toMatchObject({ pending: true });
    expect(store.state.states.s1?.transcript).toMatchObject([
      { kind: "bash", command: "ls", status: "running" },
    ]);
    await vi.waitFor(() =>
      expect(store.state.states.s1?.activeBash).toBeUndefined(),
    );
    expect(store.state.states.s1?.transcript).toMatchObject([
      { kind: "bash", status: "done" },
    ]);
  });

  it("ignores a second command while one runs", async () => {
    await openSession("s1");
    const finish = deferBash();

    store.runBash("one", false);
    store.runBash("two", false);

    expect(mocks.executeBash).toHaveBeenCalledTimes(1);
    finish(bashResult());
    await vi.waitFor(() =>
      expect(store.state.states.s1?.activeBash).toBeUndefined(),
    );
  });

  it("finalizes the card when the command cannot start", async () => {
    await openSession("s1");
    mocks.executeBash.mockRejectedValue(new Error("Session is not running"));

    store.runBash("ls", false);

    await vi.waitFor(() =>
      expect(store.state.states.s1?.activeBash).toBeUndefined(),
    );
    expect(store.state.states.s1?.transcript).toMatchObject([
      { kind: "bash", output: "Session is not running", status: "error" },
    ]);
  });

  it("aborts the running command instead of the turn", async () => {
    await openSession("s1");
    const finish = deferBash();
    store.runBash("sleep 10", false);

    store.abort();

    expect(mocks.abortBash).toHaveBeenCalledWith("s1");
    expect(mocks.abort).not.toHaveBeenCalled();
    finish(bashResult({ cancelled: true, exitCode: undefined }));
    await vi.waitFor(() =>
      expect(store.state.states.s1?.activeBash).toBeUndefined(),
    );
    expect(store.state.states.s1?.transcript).toMatchObject([
      { kind: "bash", status: "cancelled" },
    ]);
  });

  it("aborts the turn when no command is running", async () => {
    await openSession("s1");

    store.abort();

    expect(mocks.abort).toHaveBeenCalledWith("s1");
    expect(mocks.abortBash).not.toHaveBeenCalled();
  });

  it("runs a command through the session being created", async () => {
    const create = defer<SessionSummary>();
    mocks.create.mockReturnValue(create.promise);

    await store.startNewSession("/p");
    store.setDraft("!ls");
    store.runBash("ls", false);
    create.resolve(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(mocks.executeBash).toHaveBeenCalledWith(
        "s1",
        "ls",
        expect.objectContaining({ id: expect.any(String) }),
      ),
    );
  });

  it("keeps a session with bash history when its tab closes", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await store.startNewSession("/p");
    store.setDraft("!ls");
    await vi.waitFor(() => expect(store.state.selectedId).toBe("s1"));

    store.runBash("ls", false);
    await vi.waitFor(() => expect(mocks.executeBash).toHaveBeenCalled());
    store.closeTab("s1");

    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledWith("s1");
  });
});

describe("session store selection", () => {
  it("clears the draft and selects the session in one update", async () => {
    mocks.list.mockResolvedValue([session("s1", "/p")]);
    await store.loadSessions();
    await store.startNewSession("/p");

    // Typing in the composer leaves the view mounted; an intermediate update
    // with neither a draft nor a selection would tear it down mid-keystroke.
    const seen: string[] = [];
    const dispose = createRoot((root) => {
      createEffect(() => {
        const draft = store.state.newSession ? "draft" : "none";
        seen.push(`${draft}:${store.state.selectedId ?? "none"}`);
      });
      return root;
    });

    store.selectSession("s1");
    dispose();

    expect(seen).toEqual(["draft:none", "none:s1"]);
  });
});
