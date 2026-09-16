import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
} from "@earendil-works/pi-ai";
import {
  type AgentSession,
  type CreateAgentSessionResult,
  createAgentSession,
  ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AgentSessionManager } from "../src/manager";
import type { AgentManagerEvent } from "../src/types";

const agentDir = mkdtempSync(join(tmpdir(), "dotbot-agent-test-"));
const workspace = mkdtempSync(join(tmpdir(), "dotbot-workspace-test-"));
process.env.PI_CODING_AGENT_DIR = agentDir;

async function createFauxRuntime() {
  const runtime = await ModelRuntime.create({
    refreshOnCreate: false,
    authPath: join(agentDir, "auth.json"),
    modelsPath: null,
  });
  const faux = fauxProvider({
    models: [{ id: "faux-1", name: "Faux", reasoning: true }],
  });
  runtime.registerNativeProvider(faux.provider);
  return { runtime, faux };
}

function collectEvents() {
  const events: AgentManagerEvent[] = [];
  const listeners = new Set<(event: AgentManagerEvent) => void>();
  return {
    events,
    onEvent: (event: AgentManagerEvent) => {
      events.push(event);
      for (const listener of listeners) listener(event);
    },
    waitFor: (
      predicate: (event: AgentManagerEvent) => boolean,
      timeoutMs = 5_000,
    ) =>
      new Promise<void>((resolve, reject) => {
        if (events.some(predicate)) {
          resolve();
          return;
        }
        const handler = (event: AgentManagerEvent) => {
          if (!predicate(event)) return;
          clearTimeout(timer);
          listeners.delete(handler);
          resolve();
        };
        const timer = setTimeout(() => {
          listeners.delete(handler);
          reject(new Error("Timed out waiting for manager event"));
        }, timeoutMs);
        listeners.add(handler);
      }),
  };
}

describe("AgentSessionManager", () => {
  let manager: AgentSessionManager | undefined;

  beforeEach(() => {
    manager?.stopAll();
    manager = undefined;
  });

  afterAll(() => {
    manager?.stopAll();
  });

  async function startManager() {
    const { runtime, faux } = await createFauxRuntime();
    faux.setResponses([fauxAssistantMessage([fauxText("hello from faux")])]);
    const collector = collectEvents();
    manager = new AgentSessionManager({
      onEvent: collector.onEvent,
      modelRuntime: runtime,
      createSession: (options) =>
        createAgentSession({ ...options, model: faux.getModel() }),
    });
    return { manager, faux, collector };
  }

  it("creates, opens, and streams a prompt through the manager", async () => {
    const { manager: sessions, collector } = await startManager();

    const created = await sessions.create(workspace);
    expect(created.title).toBe("new session");
    expect(created.active).toBe(false);
    expect(created.piSessionId).toBe(created.id);

    const opened = await sessions.open(created.id);
    expect(opened.status).toBe("ready");
    expect(opened.id).toBe(created.id);
    expect(opened.piSessionId).toBe(created.id);

    await collector.waitFor(
      (event) =>
        event.type === "session_state" &&
        event.state.selectedModel === "faux/faux-1",
    );

    await sessions.prompt({ sessionId: created.id, message: "hi" });
    await collector.waitFor(
      (event) =>
        event.type === "session_event" && event.event.type === "agent_settled",
    );

    const types = collector.events
      .filter(
        (event) =>
          event.type === "session_event" && event.sessionId === created.id,
      )
      .map((event) => (event.type === "session_event" ? event.event.type : ""));
    expect(types).toContain("agent_start");
    expect(types).toContain("message_update");
    expect(types).toContain("agent_settled");

    const summary = (await sessions.list()).find(
      (session) => session.id === created.id,
    );
    expect(summary?.title).toBe("hi");
    expect(summary?.active).toBe(true);
  });

  it("applies model and thinking commands and reports session state", async () => {
    const { manager: sessions, collector } = await startManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    await sessions.command({
      sessionId: created.id,
      command: { type: "set_model", provider: "faux", modelId: "faux-1" },
    });
    await sessions.command({
      sessionId: created.id,
      command: { type: "set_thinking_level", level: "low" },
    });

    const last = collector.events
      .filter((event) => event.type === "session_state")
      .at(-1);
    expect(last?.type === "session_state" && last.state.selectedModel).toBe(
      "faux/faux-1",
    );
    expect(last?.type === "session_state" && last.state.thinkingLevel).toBe(
      "low",
    );
  });

  it("lists persisted sessions from a previous manager", async () => {
    const { manager: sessions, collector } = await startManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);
    await sessions.prompt({ sessionId: created.id, message: "persist me" });
    await collector.waitFor(
      (event) =>
        event.type === "session_event" && event.event.type === "agent_settled",
    );
    sessions.stopAll();

    const { runtime, faux } = await createFauxRuntime();
    const fresh = new AgentSessionManager({
      modelRuntime: runtime,
      createSession: (options) =>
        createAgentSession({ ...options, model: faux.getModel() }),
    });
    const listed = await fresh.list();
    const persisted = listed.find((session) => session.title === "persist me");
    expect(persisted?.id).toBe(created.id);
    expect(persisted?.piSessionId).toBe(created.id);
    fresh.stopAll();
  });

  it("rejects unknown sessions, commands, and workspaces", async () => {
    const { manager: sessions } = await startManager();
    await expect(
      sessions.prompt({ sessionId: "missing", message: "hi" }),
    ).rejects.toThrow("Session was not found");

    const created = await sessions.create(workspace);
    await expect(
      sessions.command({
        sessionId: created.id,
        command: { type: "unsupported" },
      }),
    ).rejects.toThrow("Unsupported agent command");
    await expect(sessions.create(join(workspace, "missing"))).rejects.toThrow(
      "Workspace must be a directory",
    );
  });

  it("bridges extension dialogs through feedback requests", async () => {
    const { runtime } = await createFauxRuntime();
    // `ExtensionBindings` is not re-exported by the SDK entrypoint.
    type Bindings = Parameters<AgentSession["bindExtensions"]>[0];
    let bindings: Bindings | undefined;
    const stub = {
      sessionId: "stub-session",
      sessionFile: undefined,
      isStreaming: false,
      messages: [],
      model: undefined,
      thinkingLevel: "medium",
      getAvailableThinkingLevels: () => ["off", "low"],
      subscribe: () => () => {},
      bindExtensions: async (value: Bindings) => {
        bindings = value;
      },
      prompt: async () => {},
      abort: async () => {},
      setModel: async () => {},
      setThinkingLevel: () => {},
      dispose: () => {},
    } as unknown as AgentSession;
    const collector = collectEvents();
    const sessions = new AgentSessionManager({
      onEvent: collector.onEvent,
      modelRuntime: runtime,
      createSession: async () =>
        ({ session: stub }) as unknown as CreateAgentSessionResult,
    });
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    const uiContext = bindings?.uiContext;
    if (!uiContext) throw new Error("Extension UI context was not bound");
    const answer = uiContext.select("Pick one", ["a", "b"]);
    const request = collector.events.find(
      (event) => event.type === "feedback_request",
    );
    expect(request?.type === "feedback_request" && request.request.method).toBe(
      "select",
    );
    if (request?.type !== "feedback_request") return;

    sessions.respond({
      sessionId: created.id,
      response: {
        type: "extension_ui_response",
        id: request.request.id,
        value: "b",
      },
    });
    await expect(answer).resolves.toBe("b");
    sessions.stopAll();
  });

  it("defaults the Pi data directory to Dotbot's own agent directory", () => {
    const previous = process.env.PI_CODING_AGENT_DIR;
    delete process.env.PI_CODING_AGENT_DIR;
    try {
      new AgentSessionManager();
      expect(process.env.PI_CODING_AGENT_DIR).toBe(
        join(homedir(), ".dot", "agent"),
      );

      process.env.PI_CODING_AGENT_DIR = "/tmp/explicit-agent-dir";
      new AgentSessionManager();
      expect(process.env.PI_CODING_AGENT_DIR).toBe("/tmp/explicit-agent-dir");
    } finally {
      if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = previous;
    }
  });
});
