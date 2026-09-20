import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxProvider, type Provider } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import type { AgentManagerEvent } from "../src/types";

/** Agent data directory shared by every agent-core test. */
export const agentDir = mkdtempSync(join(tmpdir(), "dotbot-agent-test-"));

process.env.PI_CODING_AGENT_DIR = agentDir;

/** Pi runtime with one faux provider, backed by the test agent directory. */
export async function createFauxRuntime() {
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

/** Collect manager events and wait for one matching a predicate. */
export function collectEvents() {
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
      throw new Error("stream is not used in agent tests");
    },
    streamSimple: () => {
      throw new Error("streamSimple is not used in agent tests");
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

export function authKeyProvider(): Provider {
  return apiKeyProvider("test-auth", "Test Auth", async ({ prompt }) => ({
    type: "api_key",
    key: await prompt({ type: "secret", message: "Enter Test Auth key" }),
  }));
}

export function oauthOnlyProvider(): Provider {
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

export function selectFirstProvider(): Provider {
  return apiKeyProvider("test-select", "Test Select", async ({ prompt }) => ({
    type: "api_key",
    key: await prompt({
      type: "select",
      message: "Choose method",
      options: [{ id: "key", label: "Key" }],
    }),
  }));
}

export function twoStepProvider(): Provider {
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

/** Minimal Pi session stub for tests that need a controllable failure. */
export function stubSession(
  overrides: Partial<AgentSession> = {},
): AgentSession {
  return {
    sessionId: "stub-session",
    sessionFile: undefined,
    isStreaming: false,
    messages: [],
    model: undefined,
    thinkingLevel: "medium",
    getAvailableThinkingLevels: () => ["off", "low"],
    subscribe: () => () => {},
    bindExtensions: async () => {},
    prompt: async () => {},
    abort: async () => {},
    setModel: async () => {},
    setThinkingLevel: () => {},
    dispose: () => {},
    ...overrides,
  } as unknown as AgentSession;
}
