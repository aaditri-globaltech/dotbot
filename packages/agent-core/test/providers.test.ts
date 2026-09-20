import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../src/providers";
import {
  agentDir,
  authKeyProvider,
  createFauxRuntime,
  oauthOnlyProvider,
  selectFirstProvider,
  twoStepProvider,
} from "./helpers";

async function startRegistry() {
  const { runtime, faux } = await createFauxRuntime();
  return {
    providers: new ProviderRegistry(async () => runtime),
    runtime,
    faux,
  };
}

describe("ProviderRegistry", () => {
  it("lists API key providers and manages a stored key", async () => {
    const { providers, runtime } = await startRegistry();
    runtime.registerNativeProvider(authKeyProvider());

    const listed = (await providers.list()).find(
      (provider) => provider.id === "test-auth",
    );
    expect(listed).toEqual({
      id: "test-auth",
      name: "Test Auth",
      configured: false,
    });

    const saved = await providers.setApiKey({
      providerId: "test-auth",
      apiKey: "sk-test",
    });
    expect(saved.configured).toBe(true);
    expect(
      readStoredCredential("test-auth", join(agentDir, "auth.json")),
    ).toEqual({ type: "api_key", key: "sk-test" });

    const removed = await providers.removeApiKey("test-auth");
    expect(removed.configured).toBe(false);
    expect(
      readStoredCredential("test-auth", join(agentDir, "auth.json")),
    ).toBeUndefined();
  });

  it("excludes providers without API key auth", async () => {
    const { providers, runtime } = await startRegistry();
    runtime.registerNativeProvider(oauthOnlyProvider());

    const ids = (await providers.list()).map((provider) => provider.id);
    expect(ids).not.toContain("test-oauth");
  });

  it("rejects providers whose setup needs more than a key", async () => {
    const { providers, runtime } = await startRegistry();
    runtime.registerNativeProvider(selectFirstProvider());
    runtime.registerNativeProvider(twoStepProvider());

    await expect(
      providers.setApiKey({
        providerId: "test-select",
        apiKey: "sk-x",
      }),
    ).rejects.toThrow("requires additional setup");
    await expect(
      providers.setApiKey({
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
    const { providers, faux } = await startRegistry();

    await expect(
      providers.setApiKey({ providerId: "missing", apiKey: "sk-x" }),
    ).rejects.toThrow("does not support API key setup");
    await expect(
      providers.setApiKey({
        providerId: faux.provider.id,
        apiKey: "sk-x",
      }),
    ).rejects.toThrow("does not support API key setup");
    await expect(
      providers.setApiKey({ providerId: "missing", apiKey: " " }),
    ).rejects.toThrow("API key is required");
  });

  it("adds a custom provider to models.json", async () => {
    const { providers } = await startRegistry();

    const added = await providers.addCustom({
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

    const listed = (await providers.list()).find(
      (provider) => provider.id === "custom-local",
    );
    expect(listed?.configured).toBe(false);

    const saved = await providers.setApiKey({
      providerId: "custom-local",
      apiKey: "local-key",
    });
    expect(saved.configured).toBe(true);
  });

  it("rejects duplicate and colliding custom providers", async () => {
    const { providers, faux } = await startRegistry();

    await providers.addCustom({
      id: "custom-dup",
      baseUrl: "http://localhost:2345/v1",
      api: "openai-completions",
      models: ["model-a"],
    });
    await expect(
      providers.addCustom({
        id: "custom-dup",
        baseUrl: "http://localhost:2345/v1",
        api: "openai-completions",
        models: ["model-a"],
      }),
    ).rejects.toThrow("already exists");
    await expect(
      providers.addCustom({
        id: faux.provider.id,
        baseUrl: "http://localhost:2345/v1",
        api: "openai-completions",
        models: ["model-a"],
      }),
    ).rejects.toThrow("already exists");
  });

  it("validates custom provider input", async () => {
    const { providers } = await startRegistry();

    await expect(
      providers.addCustom({
        id: "bad api",
        baseUrl: "http://localhost:1",
        api: "openai-completions",
        models: ["model-a"],
      }),
    ).rejects.toThrow("whitespace");
    await expect(
      providers.addCustom({
        id: "bad-api",
        baseUrl: "http://localhost:1",
        api: "unsupported",
        models: ["model-a"],
      }),
    ).rejects.toThrow("not supported");
    await expect(
      providers.addCustom({
        id: "bad-models",
        baseUrl: "http://localhost:1",
        api: "openai-completions",
        models: [],
      }),
    ).rejects.toThrow("At least one model id");
  });
});
