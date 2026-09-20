import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  type CreateAgentSessionResult,
  createAgentSession,
} from "@earendil-works/pi-coding-agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AgentManager } from "../src/agent-manager";
import {
  agentDir,
  collectEvents,
  createFauxRuntime,
  stubSession,
} from "./helpers";

const workspace = mkdtempSync(join(tmpdir(), "dotbot-workspace-test-"));

describe("AgentManager", () => {
  let manager: AgentManager | undefined;

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
    manager = new AgentManager({
      onEvent: collector.onEvent,
      modelRuntime: runtime,
      createSession: (options) =>
        createAgentSession({ ...options, model: faux.getModel() }),
    });
    return { manager, faux, collector, runtime };
  }

  it("creates, opens, and streams a prompt through the manager", async () => {
    const { manager: sessions, collector } = await startManager();

    const created = await sessions.create(workspace);
    expect(created.title).toBe("new session");
    expect(created.active).toBe(false);
    expect(created.projectDir).toBe(workspace);

    const opened = await sessions.open(created.id);
    expect(opened.status).toBe("idle");
    expect(opened.id).toBe(created.id);

    await collector.waitFor(
      (event) =>
        event.type === "session_controls" &&
        event.controls.selectedModel === "faux/faux-1",
    );

    await sessions.prompt({ sessionId: created.id, message: "hi" });
    await collector.waitFor(
      (event) =>
        event.type === "session_activity" &&
        event.event.type === "agent_settled",
    );

    const types = collector.events
      .filter(
        (event) =>
          event.type === "session_activity" && event.sessionId === created.id,
      )
      .map((event) =>
        event.type === "session_activity" ? event.event.type : "",
      );
    expect(types).toContain("agent_start");
    expect(types).toContain("message_update");
    expect(types).toContain("agent_settled");

    const summary = (await sessions.list()).find(
      (session) => session.id === created.id,
    );
    expect(summary?.title).toBe("hi");
    expect(summary?.active).toBe(true);
  });

  it("applies model and thinking level changes and reports session controls", async () => {
    const { manager: sessions, collector } = await startManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    await sessions.setModel({
      sessionId: created.id,
      provider: "faux",
      modelId: "faux-1",
    });
    await sessions.setThinkingLevel({
      sessionId: created.id,
      level: "low",
    });

    const last = collector.events
      .filter((event) => event.type === "session_controls")
      .at(-1);
    expect(
      last?.type === "session_controls" && last.controls.selectedModel,
    ).toBe("faux/faux-1");
    expect(
      last?.type === "session_controls" && last.controls.thinkingLevel,
    ).toBe("low");

    const settings = JSON.parse(
      readFileSync(join(agentDir, "settings.json"), "utf-8"),
    );
    expect(settings.defaultProvider).toBe("faux");
    expect(settings.defaultModel).toBe("faux-1");
    expect(settings.defaultThinkingLevel).toBe("low");
  });

  it("removes a session that was never prompted", async () => {
    const { manager: sessions } = await startManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);

    sessions.discard(created.id);

    expect(
      (await sessions.list()).some((session) => session.id === created.id),
    ).toBe(false);
  });

  it("reports a project's model and thinking controls before any session", async () => {
    const { manager: sessions } = await startManager();

    const controls = await sessions.getSessionControls({
      projectDir: workspace,
    });
    expect(
      controls.models.map((model) => `${model.provider}/${model.id}`),
    ).toContain("faux/faux-1");
    expect(controls.selectedModel).toBe("faux/faux-1");
    expect(controls.thinkingLevels).toContain(controls.thinkingLevel);
    expect(controls.thinkingLevels).toContain("high");

    const requested = await sessions.getSessionControls({
      projectDir: workspace,
      provider: "faux",
      modelId: "faux-1",
    });
    expect(requested.selectedModel).toBe("faux/faux-1");
  });

  it("lists persisted sessions from a previous manager", async () => {
    const { manager: sessions, collector } = await startManager();
    const created = await sessions.create(workspace);
    await sessions.open(created.id);
    await sessions.prompt({ sessionId: created.id, message: "persist me" });
    await collector.waitFor(
      (event) =>
        event.type === "session_activity" &&
        event.event.type === "agent_settled",
    );
    sessions.stopAll();

    const { runtime, faux } = await createFauxRuntime();
    const fresh = new AgentManager({
      modelRuntime: runtime,
      createSession: (options) =>
        createAgentSession({ ...options, model: faux.getModel() }),
    });
    const listed = await fresh.list();
    const persisted = listed.find((session) => session.title === "persist me");
    expect(persisted?.id).toBe(created.id);
    expect(listed.filter((session) => session.id === created.id)).toHaveLength(
      1,
    );
    fresh.stopAll();
  });

  it("rejects unknown sessions, control changes, and projects", async () => {
    const { manager: sessions } = await startManager();
    await expect(
      sessions.prompt({ sessionId: "missing", message: "hi" }),
    ).rejects.toThrow("Session was not found");

    const created = await sessions.create(workspace);
    await expect(
      sessions.setModel({
        sessionId: created.id,
        provider: "",
        modelId: "faux-1",
      }),
    ).rejects.toThrow("Model selection is invalid");
    await expect(
      sessions.setThinkingLevel({
        sessionId: created.id,
        level: "impossible",
      }),
    ).rejects.toThrow("Thinking level is invalid");
    await expect(sessions.create(join(workspace, "missing"))).rejects.toThrow(
      "Project directory does not exist",
    );
  });

  it("bridges extension dialogs through extension requests", async () => {
    const { runtime } = await createFauxRuntime();
    // `ExtensionBindings` is not re-exported by the SDK entrypoint.
    type Bindings = Parameters<AgentSession["bindExtensions"]>[0];
    let bindings: Bindings | undefined;
    const stub = stubSession({
      bindExtensions: async (value: Bindings) => {
        bindings = value;
      },
    });
    const collector = collectEvents();
    const sessions = new AgentManager({
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
      (event) => event.type === "extension_request",
    );
    expect(
      request?.type === "extension_request" && request.request.method,
    ).toBe("select");
    if (request?.type !== "extension_request") return;

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

  it("reports a failed prompt as a session error event", async () => {
    const { runtime } = await createFauxRuntime();
    const collector = collectEvents();
    const sessions = new AgentManager({
      onEvent: collector.onEvent,
      modelRuntime: runtime,
      createSession: async () =>
        ({
          session: stubSession({
            prompt: async () => {
              throw new Error("boom");
            },
          }),
        }) as unknown as CreateAgentSessionResult,
    });
    const created = await sessions.create(workspace);
    await sessions.open(created.id);
    await sessions.prompt({ sessionId: created.id, message: "hi" });
    await collector.waitFor((event) => event.type === "session_error");

    const error = collector.events.find(
      (event) => event.type === "session_error",
    );
    expect(error?.type === "session_error" && error.message).toBe("boom");
    sessions.stopAll();
  });
});
