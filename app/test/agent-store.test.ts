/**
 * The new-task template must not create a session until the user types, and
 * the workspace must never be populated from the persisted session list.
 */

import type {
  AgentSessionState,
  AgentSessionSummary,
  AgentThinkingLevel,
} from "@dotbot/agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  defaults: vi.fn(),
  create: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  remove: vi.fn(),
  prompt: vi.fn(),
  command: vi.fn(),
  list: vi.fn(),
  pick: vi.fn(),
}));

vi.mock("../src/renderer/api", () => ({
  api: {
    agent: {
      defaults: mocks.defaults,
      create: mocks.create,
      open: mocks.open,
      close: mocks.close,
      remove: mocks.remove,
      prompt: mocks.prompt,
      command: mocks.command,
      list: mocks.list,
    },
    projects: { pick: mocks.pick },
  },
}));

import { useAgentStore } from "../src/renderer/stores/agent-store";
import { useWorkspaceStore } from "../src/renderer/stores/workspace-store";

function session(
  id: string,
  cwd: string,
  overrides: Partial<AgentSessionSummary> = {},
): AgentSessionSummary {
  return {
    id,
    cwd,
    title: id,
    status: "idle",
    active: false,
    unread: false,
    lastActivity: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const defaults: AgentSessionState = {
  models: [{ provider: "faux", id: "faux-1", name: "Faux" }],
  selectedModel: "faux/faux-1",
  thinkingLevel: "medium",
  thinkingLevels: [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
  ] as AgentThinkingLevel[],
};

beforeEach(() => {
  useAgentStore.setState({
    sessions: [],
    tabs: [],
    selectedId: undefined,
    states: {},
    template: undefined,
  });
  useWorkspaceStore.setState({
    screen: "dashboard",
    sidebarMode: "tasks",
    managePage: "general",
    projects: [],
    selectedProject: undefined,
  });
  vi.clearAllMocks();
  mocks.defaults.mockResolvedValue(defaults);
  mocks.open.mockImplementation(async (id: string) => session(id, "/p"));
  mocks.prompt.mockResolvedValue(undefined);
  mocks.command.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});

describe("agent store new-task template", () => {
  it("creates no session until the first keystroke", async () => {
    await useAgentStore.getState().startNewTask("/p");
    expect(useAgentStore.getState().template).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().projects).toEqual(["/p"]);
    expect(useWorkspaceStore.getState().screen).toBe("workbench");

    mocks.create.mockResolvedValue(session("s1", "/p"));
    useAgentStore.getState().setDraft("h");

    await vi.waitFor(() =>
      expect(useAgentStore.getState().selectedId).toBe("s1"),
    );
    expect(mocks.create).toHaveBeenCalledWith("/p");
    expect(useAgentStore.getState().template).toBeUndefined();
    expect(useAgentStore.getState().tabs).toEqual(["s1"]);
    expect(useAgentStore.getState().states.s1?.draft).toBe("h");
  });

  it("keeps typing that arrives while the session is being created", async () => {
    let resolveCreate!: (value: AgentSessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().setDraft("h");
    useAgentStore.getState().setDraft("he");
    useAgentStore.getState().setDraft("hel");
    resolveCreate(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(useAgentStore.getState().selectedId).toBe("s1"),
    );
    expect(useAgentStore.getState().states.s1?.draft).toBe("hel");
  });

  it("keeps typing that arrives while the session is starting", async () => {
    let resolveOpen!: (value: AgentSessionSummary) => void;
    mocks.create.mockResolvedValue(session("s1", "/p"));
    mocks.open.mockReturnValue(
      new Promise((resolve) => {
        resolveOpen = resolve;
      }),
    );

    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().setDraft("h");
    await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledWith("s1"));
    useAgentStore.getState().setDraft("hi");
    resolveOpen(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(useAgentStore.getState().selectedId).toBe("s1"),
    );
    expect(useAgentStore.getState().states.s1?.draft).toBe("hi");
  });

  it("sends the first message through the session being created", async () => {
    let resolveCreate!: (value: AgentSessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().setDraft("h");
    useAgentStore.getState().prompt("hello");
    resolveCreate(session("s1", "/p"));

    await vi.waitFor(() =>
      expect(mocks.prompt).toHaveBeenCalledWith("s1", "hello", undefined),
    );
    expect(useAgentStore.getState().states.s1?.draft).toBe("");
    expect(useAgentStore.getState().states.s1?.messages).toMatchObject([
      { role: "user", text: "hello" },
    ]);
  });

  it("removes a session whose template was abandoned", async () => {
    let resolveCreate!: (value: AgentSessionSummary) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().setDraft("h");
    useAgentStore.getState().selectSession("other");
    resolveCreate(session("s1", "/p"));

    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("s1"));
    expect(useAgentStore.getState().selectedId).toBe("other");
    expect(
      useAgentStore.getState().sessions.some((entry) => entry.id === "s1"),
    ).toBe(false);
    expect(useAgentStore.getState().tabs).toEqual([]);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("removes an unprompted task when its tab closes", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().setDraft("h");
    await vi.waitFor(() =>
      expect(useAgentStore.getState().selectedId).toBe("s1"),
    );

    useAgentStore.getState().closeTab("s1");

    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("s1"));
    expect(
      useAgentStore.getState().sessions.some((entry) => entry.id === "s1"),
    ).toBe(false);
    expect(useAgentStore.getState().tabs).toEqual([]);
  });

  it("closes, but keeps, a task that was prompted", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().setDraft("h");
    await vi.waitFor(() =>
      expect(useAgentStore.getState().selectedId).toBe("s1"),
    );

    useAgentStore.getState().prompt("hello");
    useAgentStore.getState().closeTab("s1");

    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledWith("s1");
  });

  it("applies the template model and thinking choices to the new session", async () => {
    mocks.create.mockResolvedValue(session("s1", "/p"));
    await useAgentStore.getState().startNewTask("/p");
    useAgentStore.getState().command({
      type: "set_thinking_level",
      level: "high",
    });
    useAgentStore.getState().command({
      type: "set_model",
      provider: "faux",
      modelId: "faux-1",
    });
    useAgentStore.getState().setDraft("h");

    await vi.waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(2));
    expect(mocks.command).toHaveBeenCalledWith("s1", {
      type: "set_model",
      provider: "faux",
      modelId: "faux-1",
    });
    expect(mocks.command).toHaveBeenCalledWith("s1", {
      type: "set_thinking_level",
      level: "high",
    });
  });

  it("keeps persisted sessions out of the workspace projects", async () => {
    useWorkspaceStore.setState({
      projects: ["/opened"],
      selectedProject: "/opened",
    });
    mocks.list.mockResolvedValue([session("old", "/legacy")]);

    await useAgentStore.getState().loadSessions();

    expect(useWorkspaceStore.getState().projects).toEqual(["/opened"]);
    expect(useAgentStore.getState().sessions.map((entry) => entry.id)).toEqual([
      "old",
    ]);
  });
});
