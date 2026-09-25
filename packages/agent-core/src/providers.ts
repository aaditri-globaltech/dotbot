/**
 * Provider listing and API key management for the agent runtime.
 *
 * Owns Pi's provider credentials and custom provider entries so the agent
 * manager only orchestrates sessions.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getAgentDir,
  type ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import { asRecord, requireText } from "./text";
import {
  type CustomProviderInput,
  PROVIDER_APIS,
  type ProviderApi,
  type ProviderSummary,
} from "./types";

/** Resolves the shared model runtime lazily. */
type ModelRuntimeGetter = () => Promise<ModelRuntime>;

/** Message shown when Pi needs more than a single key prompt for a provider. */
const UNSUPPORTED_PROVIDER_SETUP =
  "This provider requires additional setup that Dotbot does not support yet";

function isProviderApi(value: unknown): value is ProviderApi {
  return PROVIDER_APIS.some((api) => api === value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function summarizeProvider(
  provider: { id: string; name: string },
  configured: boolean,
): ProviderSummary {
  return { id: provider.id, name: provider.name, configured };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function validateCustomProvider(value: unknown): CustomProviderInput {
  const input = asRecord(value) ?? {};
  const id = requireText(input.id, "Provider id is required");
  if (/\s/.test(id)) {
    throw new Error("Provider id must not contain whitespace");
  }
  const baseUrl = requireText(input.baseUrl, "Base URL is required");
  const api = input.api;
  if (!isProviderApi(api)) {
    throw new Error("Provider API type is not supported");
  }
  const modelIds = input.models;
  if (!isStringArray(modelIds)) {
    throw new Error("Model ids must be a list of strings");
  }
  const models = [
    ...new Set(modelIds.map((model) => model.trim()).filter(Boolean)),
  ];
  if (models.length === 0) {
    throw new Error("At least one model id is required");
  }
  return { id, baseUrl, api, models };
}

/** Provider listing and credential management for the agent runtime. */
export class ProviderRegistry {
  private readonly getModelRuntime: ModelRuntimeGetter;

  constructor(getModelRuntime: ModelRuntimeGetter) {
    this.getModelRuntime = getModelRuntime;
  }

  /** List Pi providers that can be configured with an API key. */
  async list(): Promise<ProviderSummary[]> {
    const runtime = await this.getModelRuntime();
    return runtime
      .getProviders()
      .filter((provider) => provider.auth.apiKey)
      .map((provider) =>
        summarizeProvider(
          provider,
          runtime.getProviderAuthStatus(provider.id).configured,
        ),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  /** Save an API key for a provider through Pi's login flow. */
  async setApiKey(value: unknown): Promise<ProviderSummary> {
    const input = asRecord(value);
    const providerId = requireText(
      input?.providerId,
      "Provider id is required",
    );
    const apiKey = requireText(input?.apiKey, "API key is required");
    const runtime = await this.getModelRuntime();
    const provider = runtime.getProvider(providerId);
    if (!provider?.auth.apiKey?.login) {
      throw new Error("Provider does not support API key setup");
    }

    // Pi's login flow starts with the key for most providers; method choices or
    // extra fields are out of scope, and nothing is persisted when this throws.
    let promptCount = 0;
    await runtime.login(providerId, "api_key", {
      prompt: async (prompt) => {
        promptCount += 1;
        if (promptCount > 1 || prompt.type !== "secret") {
          throw new Error(UNSUPPORTED_PROVIDER_SETUP);
        }
        return apiKey;
      },
      notify: () => {},
    });
    return summarizeProvider(
      provider,
      runtime.getProviderAuthStatus(providerId).configured,
    );
  }

  /** Remove a provider's stored credential. */
  async removeApiKey(value: unknown): Promise<ProviderSummary> {
    const providerId = requireText(value, "Provider id is required");
    const runtime = await this.getModelRuntime();
    const provider = runtime.getProvider(providerId);
    if (!provider?.auth.apiKey) {
      throw new Error("Provider does not support API key setup");
    }
    await runtime.logout(providerId);
    await this.waitForCredentialRemoval(runtime, providerId);
    return summarizeProvider(
      provider,
      runtime.getProviderAuthStatus(providerId).configured,
    );
  }

  /**
   * Pi synchronizes credential state asynchronously after logout, so the
   * status briefly reports the removed credential. Wait for it to settle so
   * callers never render a stale "configured" flag. A provider configured only
   * through environment variables stays configured and the wait times out.
   */
  private async waitForCredentialRemoval(
    runtime: ModelRuntime,
    providerId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!runtime.getProviderAuthStatus(providerId).configured) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /** Add a custom provider entry to the agent's models.json. */
  async addCustom(value: unknown): Promise<ProviderSummary> {
    const input = validateCustomProvider(value);
    const runtime = await this.getModelRuntime();
    if (runtime.getProvider(input.id)) {
      throw new Error(`Provider "${input.id}" already exists`);
    }

    const modelsPath = join(getAgentDir(), "models.json");
    let config: Record<string, unknown> = {};
    try {
      const parsed = asRecord(JSON.parse(await readFile(modelsPath, "utf-8")));
      if (!parsed) throw new Error("models.json must contain an object");
      config = { ...parsed };
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }

    const providers: Record<string, unknown> = {
      ...(asRecord(config.providers) ?? {}),
    };
    if (providers[input.id]) {
      throw new Error(`Provider "${input.id}" already exists`);
    }
    providers[input.id] = {
      baseUrl: input.baseUrl,
      api: input.api,
      models: input.models.map((id) => ({ id })),
    };
    config.providers = providers;

    // ponytail: plain merge-and-write; add locking if multiple processes edit models.json.
    await writeFile(
      modelsPath,
      `${JSON.stringify(config, null, 2)}\n`,
      "utf-8",
    );
    await runtime.refresh();

    const provider = runtime.getProvider(input.id);
    if (!provider) throw new Error("Custom provider could not be loaded");
    return summarizeProvider(
      provider,
      runtime.getProviderAuthStatus(input.id).configured,
    );
  }
}
