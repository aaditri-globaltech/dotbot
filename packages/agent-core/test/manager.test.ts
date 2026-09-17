import { mkdtempSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  type Provider,
} from "@earendil-works/pi-ai";
import {
  type AgentSession,
  type CreateAgentSessionResult,
  createAgentSession,
  ModelRuntime,
  readStoredCredential,
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
    modelsPath: join(agentDir, "models.json"),
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

function stubProvider(
  id: string,
  name: string,
  auth: Provider["auth"],
): Provider {
  return {
    id,
    name,
    auth,
    getModels: () => [],
    stream: () => {
      throw new Error("stream is not used in manager tests");
    },
    streamSimple: () => {
      throw new Error("streamSimple is not used in manager tests");
    },
  };
}

type ApiKeyLogin = NonNullable<Provider["auth"]["apiKey"]>["login"];

function apiKeyProvider(
  id: string,
  name: string,
  login: ApiKeyLogin,
): Provider {
  return stubProvider(id, name, {
    apiKey: {
      name: `${name} key`,
      resolve: async ({ credential }) =>
        credential?.key ? { auth: { apiKey: credential.key } } : undefined,
      login,
    },
  });
}

function authKeyProvider(): Provider {
  return apiKeyProvider("test-auth", "Test Auth", async ({ prompt }) => ({
    type: "api_key",
    key: await prompt({ type: "secret", message: "Enter Test Auth key" }),
  }));
}

function oauthOnlyProvider(): Provider {
  return stubProvider("test-oauth", "Test OAuth", {
    oauth: {
      name: "Test OAuth",
      login: async () => ({
        type: "oauth",
        refresh: "refresh",
        access: "access",
        expires: 0,
      }),
      refresh: async (credential) => credential,
      toAuth: async () => ({}),
    },
  });
}

function selectFirstProvider(): Provider {
  return apiKeyProvider("test-select", "Test Select", async ({ prompt }) => ({
    type: "api_key",
    key: await prompt({
      type: "select",
      message: "Choose method",
      options: [{ id: "key", label: "Key" }],
    }),
  }));
}

function twoStepProvider(): Provider {
  return apiKeyProvider(
    "test-two-step",
    "Test Two Step",
    async ({ prompt }) => {
      const key = await prompt({ type: "secret", message: "Enter key" });
      const account = await prompt({ type: "text", message: "Enter account" });
      return { type: "api_key", key, env: { ACCOUNT: account } };
    },
  );
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
    return { manager, faux, collector, runtime };
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

    const settings = JSON.parse(
      readFileSync(join(agentDir, "settings.json"), "utf-8"),
    );
    expect(settings.defaultProvider).toBe("faux");
    expect(settings.defaultModel).toBe("faux-1");
    expect(settings.defaultThinkingLevel).toBe("low");
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

  describe("provider API keys", () => {
    it("lists API key providers and manages a stored key", async () => {
      const { manager: sessions, runtime } = await startManager();
      runtime.registerNativeProvider(authKeyProvider());

      const listed = (await sessions.listProviders()).find(
        (provider) => provider.id === "test-auth",
      );
      expect(listed).toEqual({
        id: "test-auth",
        name: "Test Auth",
        configured: false,
      });

      const saved = await sessions.setProviderApiKey({
        providerId: "test-auth",
        apiKey: "sk-test",
      });
      expect(saved.configured).toBe(true);
      expect(
        readStoredCredential("test-auth", join(agentDir, "auth.json")),
      ).toEqual({ type: "api_key", key: "sk-test" });

      const removed = await sessions.removeProviderApiKey("test-auth");
      expect(removed.configured).toBe(false);
      expect(
        readStoredCredential("test-auth", join(agentDir, "auth.json")),
      ).toBeUndefined();
    });

    it("excludes providers without API key auth", async () => {
      const { manager: sessions, runtime } = await startManager();
      runtime.registerNativeProvider(oauthOnlyProvider());

      const ids = (await sessions.listProviders()).map(
        (provider) => provider.id,
      );
      expect(ids).not.toContain("test-oauth");
    });

    it("rejects providers whose setup needs more than a key", async () => {
      const { manager: sessions, runtime } = await startManager();
      runtime.registerNativeProvider(selectFirstProvider());
      runtime.registerNativeProvider(twoStepProvider());

      await expect(
        sessions.setProviderApiKey({
          providerId: "test-select",
          apiKey: "sk-x",
        }),
      ).rejects.toThrow("requires additional setup");
      await expect(
        sessions.setProviderApiKey({
          providerId: "test-two-step",
          apiKey: "sk-x",
        }),
      ).rejects.toThrow("requires additional setup");

      expect(
        readStoredCredential("test-select", join(agentDir, "auth.json")),
      ).toBeUndefined();
      expect(
        readStoredCredential("test-two-step", join(agentDir, "auth.json")),
      ).toBeUndefined();
    });

    it("rejects unknown and non-configurable providers", async () => {
      const { manager: sessions, faux } = await startManager();

      await expect(
        sessions.setProviderApiKey({ providerId: "missing", apiKey: "sk-x" }),
      ).rejects.toThrow("does not support API key setup");
      await expect(
        sessions.setProviderApiKey({
          providerId: faux.provider.id,
          apiKey: "sk-x",
        }),
      ).rejects.toThrow("does not support API key setup");
      await expect(
        sessions.setProviderApiKey({ providerId: "missing", apiKey: " " }),
      ).rejects.toThrow("API key is required");
    });

    it("adds a custom provider to models.json", async () => {
      const { manager: sessions } = await startManager();

      const added = await sessions.addCustomProvider({
        id: "custom-local",
        baseUrl: "http://localhost:1234/v1",
        api: "openai-completions",
        models: ["model-a", "model-b"],
      });
      expect(added.id).toBe("custom-local");
      expect(added.configured).toBe(false);

      expect(
        JSON.parse(readFileSync(join(agentDir, "models.json"), "utf-8")),
      ).toEqual({
        providers: {
          "custom-local": {
            baseUrl: "http://localhost:1234/v1",
            api: "openai-completions",
            models: [{ id: "model-a" }, { id: "model-b" }],
          },
        },
      });

      const listed = (await sessions.listProviders()).find(
        (provider) => provider.id === "custom-local",
      );
      expect(listed?.configured).toBe(false);

      const saved = await sessions.setProviderApiKey({
        providerId: "custom-local",
        apiKey: "local-key",
      });
      expect(saved.configured).toBe(true);
    });

    it("rejects duplicate and colliding custom providers", async () => {
      const { manager: sessions, faux } = await startManager();

      await sessions.addCustomProvider({
        id: "custom-dup",
        baseUrl: "http://localhost:2345/v1",
        api: "openai-completions",
        models: ["model-a"],
      });
      await expect(
        sessions.addCustomProvider({
          id: "custom-dup",
          baseUrl: "http://localhost:2345/v1",
          api: "openai-completions",
          models: ["model-a"],
        }),
      ).rejects.toThrow("already exists");
      await expect(
        sessions.addCustomProvider({
          id: faux.provider.id,
          baseUrl: "http://localhost:2345/v1",
          api: "openai-completions",
          models: ["model-a"],
        }),
      ).rejects.toThrow("already exists");
    });

    it("validates custom provider input", async () => {
      const { manager: sessions } = await startManager();

      await expect(
        sessions.addCustomProvider({
          id: "bad api",
          baseUrl: "http://localhost:1",
          api: "openai-completions",
          models: ["model-a"],
        }),
      ).rejects.toThrow("whitespace");
      await expect(
        sessions.addCustomProvider({
          id: "bad-api",
          baseUrl: "http://localhost:1",
          api: "unsupported",
          models: ["model-a"],
        }),
      ).rejects.toThrow("not supported");
      await expect(
        sessions.addCustomProvider({
          id: "bad-models",
          baseUrl: "http://localhost:1",
          api: "openai-completions",
          models: [],
        }),
      ).rejects.toThrow("At least one model id");
    });
  });

  it("defaults the Pi data directory to Dotbot's own agent directory", () => {
    const previous = process.env.PI_CODING_AGENT_DIR;
    delete process.env.PI_CODING_AGENT_DIR;
    try {
      new AgentSessionManager();
      expect(process.env.PI_CODING_AGENT_DIR).toBe(
        join(homedir(), ".bot", "agent"),
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
