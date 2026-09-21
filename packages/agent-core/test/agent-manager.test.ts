import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  CONFIG_DIR_NAME,
  type CreateAgentSessionOptions,
  type CreateAgentSessionResult,
  createAgentSession,
  ProjectTrustStore,
} from "@earendil-works/pi-coding-agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AgentManager } from "../src/agent-manager";
import { TrustManager } from "../src/trust";
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

function trustProjectDir(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "dotbot-trust-project-"));
  mkdirSync(join(projectDir, CONFIG_DIR_NAME), { recursive: true });
  writeFileSync(join(projectDir, CONFIG_DIR_NAME, "settings.json"), "{}\n");
  return projectDir;
}

function trustRequests(collector: ReturnType<typeof collectEvents>) {
  return collector.events.flatMap((event) =>
    event.type === "trust_request" ? [event.request] : [],
  );
}

function trustRequest(collector: ReturnType<typeof collectEvents>) {
  const request = trustRequests(collector)[0];
  if (request?.method !== "select")
    throw new Error("Trust request is not a select");
  return request;
}

function lastTrustRequestId(collector: ReturnType<typeof collectEvents>) {
  const request = trustRequests(collector).at(-1);
  if (!request) throw new Error("No trust request");
  return request.id;
}

async function startTrustManager(trustDir: string) {
  const { runtime, faux } = await createFauxRuntime();
  const collector = collectEvents();
  let captured: CreateAgentSessionOptions | undefined;
  const manager = new AgentManager({
    onEvent: collector.onEvent,
    modelRuntime: runtime,
    trustManager: new TrustManager(trustDir),
    createSession: (options) => {
      captured = options;
      return createAgentSession({ ...options, model: faux.getModel() });
    },
  });
  return { manager, collector, captured: () => captured };
}

function writeTrustProbe(trustDir: string, source: string): void {
  const extensionsDir = join(trustDir, "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  writeFileSync(join(extensionsDir, "trust-probe.js"), source, "utf-8");
}

function writeProjectProbe(projectDir: string, markerPath: string): void {
  const extensionsDir = join(projectDir, CONFIG_DIR_NAME, "extensions");
  mkdirSync(extensionsDir, { recursive: true });
  writeFileSync(
    join(extensionsDir, "project-probe.js"),
    `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(markerPath)}, "loaded\\n");\nexport default function (pi) {}\n`,
    "utf-8",
  );
}

describe("AgentManager project trust", () => {
  it("prompts for project trust and starts the session trusted", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    const opened = manager.open(created.id);

    await collector.waitFor((event) => event.type === "trust_request");
    const request = trustRequest(collector);
    expect(request.title).toBe(
      [
        "Trust project folder?",
        projectDir,
        "",
        `This allows Dotbot to load project-local settings and resources (.agents/skills, ${CONFIG_DIR_NAME}/*).`,
      ].join("\n"),
    );
    expect(request.options).toEqual([
      "Trust",
      `Trust parent folder (${dirname(projectDir)})`,
      "Trust (this session only)",
      "Do not trust",
      "Do not trust (this session only)",
    ]);
    manager.respondTrust({
      type: "extension_ui_response",
      id: request.id,
      value: "Trust",
    });
    await opened;

    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    expect(new TrustManager(trustDir).peek(projectDir)).toBe(true);
    const update = collector.events.find(
      (event) => event.type === "trust_update",
    );
    expect(update?.type === "trust_update" && update.decision).toBe(true);
    manager.stopAll();
  });

  it("does not prompt when a project has no trust-requiring resources", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = mkdtempSync(join(tmpdir(), "dotbot-plain-project-"));
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    await manager.open(created.id);

    expect(
      collector.events.some((event) => event.type === "trust_request"),
    ).toBe(false);
    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    expect(new TrustManager(trustDir).list()).toEqual([]);
    manager.stopAll();
  });

  it("leaves a cancelled prompt untrusted without saving", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    const opened = manager.open(created.id);

    await collector.waitFor((event) => event.type === "trust_request");
    const request = trustRequest(collector);
    manager.respondTrust({
      type: "extension_ui_response",
      id: request.id,
      cancelled: true,
    });
    await opened;

    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(false);
    expect(new TrustManager(trustDir).list()).toEqual([]);
    manager.stopAll();
  });

  it("keeps a session-only trust decision for the run", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const first = await manager.create(projectDir);
    const opened = manager.open(first.id);
    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Trust (this session only)",
    });
    await opened;

    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    expect(new TrustManager(trustDir).list()).toEqual([]);

    const second = await manager.create(projectDir);
    await manager.open(second.id);

    expect(
      collector.events.filter((event) => event.type === "trust_request"),
    ).toHaveLength(1);
    manager.stopAll();
  });

  it("remembers a do-not-trust decision for the run", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const first = await manager.create(projectDir);
    const opened = manager.open(first.id);
    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Do not trust",
    });
    await opened;

    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(false);
    expect(new TrustManager(trustDir).peek(projectDir)).toBe(false);

    const second = await manager.create(projectDir);
    await manager.open(second.id);

    expect(
      collector.events.filter((event) => event.type === "trust_request"),
    ).toHaveLength(1);
    manager.stopAll();
  });

  it("uses a saved parent-folder decision without prompting", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const parentDir = mkdtempSync(join(tmpdir(), "dotbot-trust-parent-"));
    const projectDir = join(parentDir, "child");
    mkdirSync(join(projectDir, CONFIG_DIR_NAME), { recursive: true });
    writeFileSync(join(projectDir, CONFIG_DIR_NAME, "settings.json"), "{}\n");
    new ProjectTrustStore(trustDir).set(parentDir, true);

    const { manager, collector, captured } = await startTrustManager(trustDir);
    const created = await manager.create(projectDir);
    await manager.open(created.id);

    expect(
      collector.events.some((event) => event.type === "trust_request"),
    ).toBe(false);
    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    manager.stopAll();
  });

  it("prompts once for two sessions in the same project", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const first = await manager.create(projectDir);
    const second = await manager.create(projectDir);
    const firstOpen = manager.open(first.id);
    const secondOpen = manager.open(second.id);

    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Trust",
    });
    await Promise.all([firstOpen, secondOpen]);

    expect(
      collector.events.filter((event) => event.type === "trust_request"),
    ).toHaveLength(1);
    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    manager.stopAll();
  });

  it.each(["always", "never"] as const)(
    "uses the %s default without prompting",
    async (defaultTrust) => {
      const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
      const projectDir = trustProjectDir();
      await new TrustManager(trustDir).setDefault(defaultTrust);
      const { manager, collector, captured } =
        await startTrustManager(trustDir);

      const created = await manager.create(projectDir);
      await manager.open(created.id);

      expect(
        collector.events.some((event) => event.type === "trust_request"),
      ).toBe(false);
      expect(captured()?.settingsManager?.isProjectTrusted()).toBe(
        defaultTrust === "always",
      );
      manager.stopAll();
    },
  );

  it("resolves a pending trust request when the manager stops", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    const opened = manager.open(created.id);
    await collector.waitFor((event) => event.type === "trust_request");

    manager.stopAll();
    await expect(opened).resolves.toMatchObject({ id: created.id });
    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(false);
    manager.stopAll();
  });

  it("rejects an unknown trust response", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const { manager } = await startTrustManager(trustDir);

    expect(() =>
      manager.respondTrust({
        type: "extension_ui_response",
        id: "missing",
        value: "Trust",
      }),
    ).toThrow("Trust request is no longer pending");
    manager.stopAll();
  });

  it("ignores project settings before the trust decision", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    writeFileSync(
      join(trustDir, "settings.json"),
      JSON.stringify({ defaultThinkingLevel: "low" }),
      "utf-8",
    );
    const projectDir = trustProjectDir();
    writeFileSync(
      join(projectDir, CONFIG_DIR_NAME, "settings.json"),
      JSON.stringify({ defaultThinkingLevel: "high" }),
      "utf-8",
    );
    const { manager } = await startTrustManager(trustDir);

    const controls = await manager.getSessionControls({ projectDir });
    expect(controls.thinkingLevel).toBe("low");

    new ProjectTrustStore(trustDir).set(projectDir, true);
    const trusted = await manager.getSessionControls({ projectDir });
    expect(trusted.thinkingLevel).toBe("high");
    manager.stopAll();
  });

  it("lets a global extension decide and remember trust", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    writeTrustProbe(
      trustDir,
      'export default function (pi) {\n  pi.on("project_trust", () => ({ trusted: "yes", remember: true }));\n}\n',
    );
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    await manager.open(created.id);

    expect(
      collector.events.some((event) => event.type === "trust_request"),
    ).toBe(false);
    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    expect(new ProjectTrustStore(trustDir).get(projectDir)).toBe(true);
    manager.stopAll();
  });

  it("falls through to the dialog when the extension is undecided", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    writeTrustProbe(
      trustDir,
      'export default function (pi) {\n  pi.on("project_trust", () => ({ trusted: "undecided" }));\n}\n',
    );
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    const opened = manager.open(created.id);
    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Trust",
    });
    await opened;

    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(true);
    manager.stopAll();
  });

  it("does not load project extensions before trust", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const markerPath = join(projectDir, "probe-marker.txt");
    writeProjectProbe(projectDir, markerPath);
    const { manager, collector } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    const opened = manager.open(created.id);
    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Do not trust",
    });
    await opened;

    expect(existsSync(markerPath)).toBe(false);
    manager.stopAll();
  });

  it("loads project extensions after trust", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const markerPath = join(projectDir, "probe-marker.txt");
    writeProjectProbe(projectDir, markerPath);
    const { manager, collector } = await startTrustManager(trustDir);

    const created = await manager.create(projectDir);
    const opened = manager.open(created.id);
    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Trust",
    });
    await opened;

    expect(existsSync(markerPath)).toBe(true);
    manager.stopAll();
  });

  it("re-resolves after a decision is revoked", async () => {
    const trustDir = mkdtempSync(join(tmpdir(), "dotbot-trust-store-"));
    const projectDir = trustProjectDir();
    const { manager, collector, captured } = await startTrustManager(trustDir);

    const first = await manager.create(projectDir);
    const firstOpen = manager.open(first.id);
    await collector.waitFor((event) => event.type === "trust_request");
    manager.respondTrust({
      type: "extension_ui_response",
      id: trustRequest(collector).id,
      value: "Trust",
    });
    await firstOpen;
    expect(new TrustManager(trustDir).peek(projectDir)).toBe(true);

    new TrustManager(trustDir).revoke(projectDir);
    manager.forgetTrust(projectDir);

    const second = await manager.create(projectDir);
    const secondOpen = manager.open(second.id);
    await collector.waitFor(() => trustRequests(collector).length === 2);
    manager.respondTrust({
      type: "extension_ui_response",
      id: lastTrustRequestId(collector),
      value: "Do not trust",
    });
    await secondOpen;

    expect(captured()?.settingsManager?.isProjectTrusted()).toBe(false);
    manager.stopAll();
  });
});
