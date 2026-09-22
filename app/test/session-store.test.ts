/**
 * The new session draft must not create a session until the user types, and
 * the workspace must never be populated from the persisted session list.
 */

import type {
  BashResult,
  ModelThinkingLevel,
  SessionControls,
  SessionSummary,
} from "@dotbot/agent-core";
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
    },
    projects: { pick: mocks.pick },
  },
}));

import { createSessionClientState } from "../src/renderer/components/panels/session-state";
import { useNavigationStore } from "../src/renderer/stores/navigation-store";
import { useSessionStore } from "../src/renderer/stores/session-store";
import { useWorkspaceStore } from "../src/renderer/stores/workspace-store";

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

beforeEach(() => {
  useSessionStore.setState({
    sessions: [],
    tabs: [],
    selectedId: undefined,
    states: {},
    newSession: undefined,
  });
  useNavigationStore.setState({
    screen: "dashboard",
    sidebarMode: "sessions",
    managePage: "general",
  });
  useWorkspaceStore.setState({
    projects: [],
    selectedProject: undefined,
  });
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
  mocks.executeBash.mockResolvedValue({
    output: "",
    exitCode: 0,
    cancelled: false,
    truncated: false,
  });
});

describe("session store new session", () => {
  it("creates no session until the first keystroke", async () => {
    await useSessionStore.getState().startNewSession("/p");
    expect(useSessionStore.getState().newSession).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().projects).toEqual(["/p"]);
    expect(useNavigationStore.getState().screen).toBe("workbench");

    mocks.create.mockResolvedValue(session("s1", "/p"));
    useSessionStore.getState().setDraft("h");

    await vi.waitFor(() =>
      expect(useSessionStore.getState().selectedId).toBe("s1"),
    );
    expect(mocks.create).toHaveBeenCalledWith("/p");
    expect(useSessionStore.getState().newSession).toBeUndefined();
    expect(useSessionStore.getState().tabs).toEqual(["s1"]);
    expect(useSessionStore.getState().states.s1?.draft).toBe("h");
  });

  it("keeps typing that arrives while the session is being created", async () => {
    let resolveCreate!: (value: SessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("h");
    useSessionStore.getState().setDraft("he");
    useSessionStore.getState().setDraft("hel");
    resolveCreate(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(useSessionStore.getState().selectedId).toBe("s1"),
    );
    expect(useSessionStore.getState().states.s1?.draft).toBe("hel");
  });

  it("keeps typing that arrives while the session is starting", async () => {
    let resolveOpen!: (value: SessionSummary) => void;
    mocks.create.mockResolvedValue(session("s1", "/p"));
    mocks.open.mockReturnValue(
      new Promise((resolve) => {
        resolveOpen = resolve;
      }),
    );

    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("h");
    await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledWith("s1"));
    useSessionStore.getState().setDraft("hi");
    resolveOpen(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(useSessionStore.getState().selectedId).toBe("s1"),
    );
    expect(useSessionStore.getState().states.s1?.draft).toBe("hi");
  });

  it("sends the first message through the session being created", async () => {
    let resolveCreate!: (value: SessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("h");
    useSessionStore.getState().prompt("hello");
    resolveCreate(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(mocks.prompt).toHaveBeenCalledWith("s1", "hello", undefined),
    );
    expect(useSessionStore.getState().states.s1?.draft).toBe("");
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      { role: "user", text: "hello" },
    ]);
  });

  it("removes a session whose new session was abandoned", async () => {
    let resolveCreate!: (value: SessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("h");
    useSessionStore.getState().selectSession("other");
    resolveCreate(session("s1", "/p"));

    await vi.waitFor(() => expect(mocks.discard).toHaveBeenCalledWith("s1"));
    expect(useSessionStore.getState().selectedId).toBe("other");
    expect(
      useSessionStore.getState().sessions.some((entry) => entry.id === "s1"),
    ).toBe(false);
    expect(useSessionStore.getState().tabs).toEqual([]);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("removes an unprompted session when its tab closes", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("h");
    await vi.waitFor(() =>
      expect(useSessionStore.getState().selectedId).toBe("s1"),
    );

    useSessionStore.getState().closeTab("s1");

    await vi.waitFor(() => expect(mocks.discard).toHaveBeenCalledWith("s1"));
    expect(
      useSessionStore.getState().sessions.some((entry) => entry.id === "s1"),
    ).toBe(false);
    expect(useSessionStore.getState().tabs).toEqual([]);
  });

  it("closes, but keeps, a session that was prompted", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("h");
    await vi.waitFor(() =>
      expect(useSessionStore.getState().selectedId).toBe("s1"),
    );

    useSessionStore.getState().prompt("hello");
    useSessionStore.getState().closeTab("s1");

    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledWith("s1");
  });

  it("applies the new session model and thinking choices to the new session", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setThinkingLevel("high");
    useSessionStore.getState().setModel("faux", "faux-1");
    useSessionStore.getState().setDraft("h");

    await vi.waitFor(() => expect(mocks.setModel).toHaveBeenCalledTimes(1));
    expect(mocks.setModel).toHaveBeenCalledWith("s1", "faux", "faux-1");
    expect(mocks.setThinkingLevel).toHaveBeenCalledWith("s1", "high");
  });

  it("keeps persisted sessions out of the workspace projects", async () => {
    useWorkspaceStore.setState({
      projects: ["/opened"],
      selectedProject: "/opened",
    });
    mocks.list.mockResolvedValue([session("old", "/legacy")]);

    await useSessionStore.getState().loadSessions();

    expect(useWorkspaceStore.getState().projects).toEqual(["/opened"]);
    expect(
      useSessionStore.getState().sessions.map((entry) => entry.id),
    ).toEqual(["old"]);
  });
});

/** Select a session backed by a fresh client state. */
function openSession(id: string, status: SessionSummary["status"] = "idle") {
  useSessionStore.setState({
    sessions: [session(id, "/p", { status })],
    tabs: [id],
    selectedId: id,
    states: { [id]: createSessionClientState() },
  });
}

/** Resolve a deferred bash result from a test. */
function deferBash() {
  let finish!: (result: BashResult) => void;
  mocks.executeBash.mockReturnValue(
    new Promise<BashResult>((resolve) => {
      finish = resolve;
    }),
  );
  return (result: BashResult) => finish(result);
}

describe("session store UI bash", () => {
  it("runs a command and renders the result", async () => {
    openSession("s1");
    mocks.executeBash.mockResolvedValue({
      output: "a.txt",
      exitCode: 0,
      cancelled: false,
      truncated: false,
    });

    useSessionStore.getState().runBash("ls", false);

    const active = useSessionStore.getState().states.s1?.activeBash;
    expect(active?.id).toEqual(expect.any(String));
    // An idle run enters the transcript directly, not the pending strip.
    expect(active?.pending).toBe(false);
    expect(mocks.executeBash).toHaveBeenCalledWith("s1", "ls", {
      excludeFromContext: false,
      id: active?.id,
    });
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
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
      expect(useSessionStore.getState().states.s1?.activeBash).toBeUndefined(),
    );
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      {
        id: active?.id,
        output: "a.txt",
        truncated: false,
        exitCode: 0,
        status: "done",
      },
    ]);
  });

  it("passes the excluded-from-context flag through", () => {
    openSession("s1");
    useSessionStore.getState().runBash("ls", true);

    expect(mocks.executeBash).toHaveBeenCalledWith(
      "s1",
      "ls",
      expect.objectContaining({ excludeFromContext: true }),
    );
  });

  it("marks a failed command as an error", async () => {
    openSession("s1");
    mocks.executeBash.mockResolvedValue({
      output: "boom",
      exitCode: 1,
      cancelled: false,
      truncated: false,
    });

    useSessionStore.getState().runBash("false", false);

    await vi.waitFor(() =>
      expect(useSessionStore.getState().states.s1?.activeBash).toBeUndefined(),
    );
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      { kind: "bash", output: "boom", exitCode: 1, status: "error" },
    ]);
  });

  it("moves a turn-started command into the transcript when it completes", async () => {
    openSession("s1", "running");
    mocks.executeBash.mockResolvedValue({
      output: "a.txt",
      exitCode: 0,
      cancelled: false,
      truncated: false,
    });

    useSessionStore.getState().runBash("ls", false);

    expect(useSessionStore.getState().states.s1?.activeBash).toMatchObject({
      pending: true,
    });
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      { kind: "bash", command: "ls", status: "running" },
    ]);
    await vi.waitFor(() =>
      expect(useSessionStore.getState().states.s1?.activeBash).toBeUndefined(),
    );
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      { kind: "bash", status: "done" },
    ]);
  });

  it("ignores a second command while one runs", async () => {
    openSession("s1");
    const finish = deferBash();

    useSessionStore.getState().runBash("one", false);
    useSessionStore.getState().runBash("two", false);

    expect(mocks.executeBash).toHaveBeenCalledTimes(1);
    finish({ output: "", exitCode: 0, cancelled: false, truncated: false });
    await vi.waitFor(() =>
      expect(useSessionStore.getState().states.s1?.activeBash).toBeUndefined(),
    );
  });

  it("finalizes the card when the command cannot start", async () => {
    openSession("s1");
    mocks.executeBash.mockRejectedValue(new Error("Session is not running"));

    useSessionStore.getState().runBash("ls", false);

    await vi.waitFor(() =>
      expect(useSessionStore.getState().states.s1?.activeBash).toBeUndefined(),
    );
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      { kind: "bash", output: "Session is not running", status: "error" },
    ]);
  });

  it("aborts the running command instead of the turn", async () => {
    openSession("s1");
    const finish = deferBash();
    useSessionStore.getState().runBash("sleep 10", false);

    useSessionStore.getState().abort();

    expect(mocks.abortBash).toHaveBeenCalledWith("s1");
    expect(mocks.abort).not.toHaveBeenCalled();
    finish({
      output: "",
      exitCode: undefined,
      cancelled: true,
      truncated: false,
    });
    await vi.waitFor(() =>
      expect(useSessionStore.getState().states.s1?.activeBash).toBeUndefined(),
    );
    expect(useSessionStore.getState().states.s1?.transcript).toMatchObject([
      { kind: "bash", status: "cancelled" },
    ]);
  });

  it("aborts the turn when no command is running", () => {
    openSession("s1");

    useSessionStore.getState().abort();

    expect(mocks.abort).toHaveBeenCalledWith("s1");
    expect(mocks.abortBash).not.toHaveBeenCalled();
  });

  it("runs a command through the session being created", async () => {
    let resolveCreate!: (value: SessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("!ls");
    useSessionStore.getState().runBash("ls", false);
    resolveCreate(session("s1", "/p"));

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
    await useSessionStore.getState().startNewSession("/p");
    useSessionStore.getState().setDraft("!ls");
    await vi.waitFor(() =>
      expect(useSessionStore.getState().selectedId).toBe("s1"),
    );

    useSessionStore.getState().runBash("ls", false);
    await vi.waitFor(() => expect(mocks.executeBash).toHaveBeenCalled());
    useSessionStore.getState().closeTab("s1");

    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledWith("s1");
  });
});
