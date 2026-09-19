/**
 * In-process Pi session manager backing the Dotbot desktop app.
 *
 * Owns one `AgentSession` per workspace session, forwards Pi's streamed events
 * to the renderer, exposes model/thinking controls, and bridges Pi extension
 * dialogs to renderer feedback requests.
 */

import { randomUUID } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  type AgentSession,
  type AgentSessionEvent,
  type CreateAgentSessionOptions,
  type CreateAgentSessionResult,
  createAgentSession,
  type ExtensionUIContext,
  getAgentDir,
  ModelRuntime,
  type SessionInfo,
  SessionManager,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { compactAgentHistory } from "./history";
import type {
  AgentCommand,
  AgentCustomProviderInput,
  AgentFeedbackPayload,
  AgentFeedbackRequest,
  AgentFeedbackResponse,
  AgentManagerEvent,
  AgentProviderApi,
  AgentProviderSummary,
  AgentSessionState,
  AgentSessionSummary,
  AgentStatus,
  AgentStreamingBehavior,
  AgentThinkingLevel,
} from "./types";
import { AGENT_PROVIDER_APIS } from "./types";

/** Limit initial history notifications so the renderer stays responsive. */
const HISTORY_CHUNK_SIZE = 8;

type JsonObject = Record<string, unknown>;

/** Resolves one pending extension dialog when the renderer answers or it expires. */
type PendingFeedback = (value: string | boolean | undefined) => void;

type SessionRecord = {
  id: string;
  cwd: string;
  path?: string;
  piSessionId?: string;
  title: string;
  name?: string;
  status: AgentStatus;
  active: boolean;
  /** Whether the UI still has this session open. */
  opened: boolean;
  /** Whether Pi has finished the current turn. */
  settled: boolean;
  waiting?: AgentFeedbackRequest;
  lastActivity: string;
  session?: AgentSession;
  /** Reserved session manager for a record that has not started yet. */
  sessionManager?: SessionManager;
  unsubscribe?: () => void;
  starting?: Promise<void>;
  pendingFeedback: Map<string, PendingFeedback>;
};

/** Pi's session factory; injectable so tests can provide a faux-provider session. */
export type CreateSessionFunction = (
  options?: CreateAgentSessionOptions,
) => Promise<CreateAgentSessionResult>;

/** Configuration for the in-process session manager. */
export type AgentSessionManagerOptions = {
  /** Receives app-facing session and stream events. */
  onEvent?: (event: AgentManagerEvent) => void;
  /** Overrides Pi's session factory. Defaults to `createAgentSession`. */
  createSession?: CreateSessionFunction;
  /** Reuses a configured Pi model runtime across sessions. */
  modelRuntime?: ModelRuntime;
};

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function summary(record: SessionRecord): AgentSessionSummary {
  return {
    id: record.id,
    piSessionId: record.piSessionId,
    cwd: record.cwd,
    title: record.title,
    name: record.name,
    status: record.status,
    active: record.active,
    waiting: record.waiting,
    unread: false,
    lastActivity: record.lastActivity,
  };
}

function truncate(value: string, length = 80): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function titleForSession(info: SessionInfo): string {
  return (
    info.name || truncate(info.firstMessage) || basename(info.path, ".jsonl")
  );
}

function isThinkingLevel(value: unknown): value is AgentThinkingLevel {
  return (
    value === "off" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  );
}

/** Validate commands crossing the renderer-to-Pi boundary. */
function validateCommand(value: unknown): AgentCommand {
  const command = asObject(value);
  if (command?.type === "set_model") {
    if (
      typeof command.provider !== "string" ||
      !command.provider.trim() ||
      typeof command.modelId !== "string" ||
      !command.modelId.trim()
    ) {
      throw new Error("Model selection is invalid");
    }
    return {
      type: "set_model",
      provider: command.provider,
      modelId: command.modelId,
    };
  }

  if (
    command?.type === "set_thinking_level" &&
    isThinkingLevel(command.level)
  ) {
    return { type: "set_thinking_level", level: command.level };
  }

  throw new Error("Unsupported agent command");
}

function isFeedbackResponse(value: unknown): value is AgentFeedbackResponse {
  const response = asObject(value);
  if (
    response?.type !== "extension_ui_response" ||
    typeof response.id !== "string"
  ) {
    return false;
  }

  const hasValue = typeof response.value === "string";
  const hasConfirmation = typeof response.confirmed === "boolean";
  const cancelled = response.cancelled === true;
  return Number(hasValue) + Number(hasConfirmation) + Number(cancelled) === 1;
}

async function validateDirectory(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Workspace must be a directory");
  }
  const cwd = resolve(value);
  const info = await stat(cwd).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error("Workspace must be a directory");
  return cwd;
}

/** Message shown when Pi needs more than a single key prompt for a provider. */
const UNSUPPORTED_PROVIDER_SETUP =
  "This provider requires additional setup that Dotbot does not support yet";

function requireText(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
}

function isProviderApi(value: unknown): value is AgentProviderApi {
  return AGENT_PROVIDER_APIS.some((api) => api === value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function summarizeProvider(
  provider: { id: string; name: string },
  configured: boolean,
): AgentProviderSummary {
  return { id: provider.id, name: provider.name, configured };
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function validateCustomProvider(value: unknown): AgentCustomProviderInput {
  const input = asObject(value) ?? {};
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

/** Owns the in-process Pi sessions and emits app-facing manager events. */
export class AgentSessionManager {
  private readonly onEvent?: (event: AgentManagerEvent) => void;
  private readonly createSession: CreateSessionFunction;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly injectedModelRuntime?: ModelRuntime;
  private modelRuntimePromise?: Promise<ModelRuntime>;

  constructor(options: AgentSessionManagerOptions = {}) {
    // Pi's data (auth, models, sessions) lives in Dotbot's own directory; an
    // explicit PI_CODING_AGENT_DIR still wins.
    process.env.PI_CODING_AGENT_DIR ??= join(homedir(), ".bot", "agent");
    this.onEvent = options.onEvent;
    this.createSession = options.createSession ?? createAgentSession;
    this.injectedModelRuntime = options.modelRuntime;
  }

  /** List persisted sessions plus sessions created in this process. */
  async list(): Promise<AgentSessionSummary[]> {
    await this.refreshPersistedSessions();
    return [...this.sessions.values()]
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
      .map(summary);
  }

  /** Create an idle session for an existing workspace directory. */
  async create(cwdValue: unknown): Promise<AgentSessionSummary> {
    const cwd = await validateDirectory(cwdValue);
    // Reserve Pi's session id up front so the record is identified by it from the start.
    const sessionManager = SessionManager.create(cwd);
    const record = this.insertRecord(sessionManager.getSessionId(), cwd);
    record.sessionManager = sessionManager;
    record.piSessionId = record.id;
    this.emitSessionUpdate(record);
    return summary(record);
  }

  /** Open a session, creating its in-process Pi session on first use. */
  async open(id: unknown): Promise<AgentSessionSummary> {
    const record = this.getRecord(id);
    record.opened = true;
    await this.ensureSession(record);
    return summary(record);
  }

  /** Close a session; a running turn is allowed to settle before Pi stops. */
  close(id: unknown): void {
    const record = this.getRecord(id);
    record.opened = false;
    if (record.session && record.settled) this.disposeRecord(record);
  }

  /** Send a prompt, starting the session when it is not active. */
  async prompt(value: unknown): Promise<void> {
    const input = asObject(value);
    if (typeof input?.message !== "string" || !input.message.trim()) {
      throw new Error("Prompt must not be empty");
    }
    if (
      input.streamingBehavior !== undefined &&
      input.streamingBehavior !== "steer" &&
      input.streamingBehavior !== "followUp"
    ) {
      throw new Error("Streaming behavior is invalid");
    }

    const record = this.getRecord(input?.sessionId);
    record.opened = true;
    await this.ensureSession(record);
    const session = record.session;
    if (!session) throw new Error("Session is not running");

    const message = input.message.trim();
    if (!record.name && record.title === "new task") {
      record.title = truncate(message);
      this.emitSessionUpdate(record);
    }

    // Reflect the accepted prompt immediately; Pi emits agent_start asynchronously.
    record.waiting = undefined;
    record.settled = false;
    this.setStatus(record, "running");
    session
      .prompt(
        message,
        input.streamingBehavior
          ? {
              streamingBehavior:
                input.streamingBehavior as AgentStreamingBehavior,
            }
          : {},
      )
      .catch((error: unknown) => this.failRecord(record, error));
  }

  /** Abort the current turn of an active session. */
  abort(id: unknown): void {
    const record = this.getRecord(id);
    void record.session?.abort().catch((error: unknown) => {
      this.failRecord(record, error);
    });
  }

  /** Apply a model or thinking-level command and persist it for new sessions. */
  async command(value: unknown): Promise<void> {
    const input = asObject(value);
    const command = validateCommand(input?.command);
    const record = this.getRecord(input?.sessionId);
    await this.ensureSession(record);
    const session = record.session;
    if (!session) throw new Error("Session is not running");

    if (command.type === "set_thinking_level") {
      session.setThinkingLevel(command.level);
      session.settingsManager.setDefaultThinkingLevel(command.level);
      await session.settingsManager.flush();
    } else {
      const modelRuntime = await this.getModelRuntime();
      const model = modelRuntime.getModel(command.provider, command.modelId);
      if (!model) throw new Error("Model was not found");
      await session.setModel(model);
      session.settingsManager.setDefaultModelAndProvider(
        command.provider,
        command.modelId,
      );
      await session.settingsManager.flush();
    }

    await this.emitState(record);
  }

  /** Answer the feedback request currently pending for a session. */
  respond(value: unknown): void {
    const input = asObject(value);
    const record = this.getRecord(input?.sessionId);
    const response = this.validateFeedbackResponse(input?.response, record);
    const resolve = record.pendingFeedback.get(response.id);
    if (!resolve) throw new Error("Feedback request is no longer pending");

    if ("cancelled" in response) resolve(undefined);
    else if ("confirmed" in response) resolve(response.confirmed);
    else resolve(response.value);
  }

  /** List Pi providers that can be configured with an API key. */
  async listProviders(): Promise<AgentProviderSummary[]> {
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
  async setProviderApiKey(value: unknown): Promise<AgentProviderSummary> {
    const input = asObject(value);
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
  async removeProviderApiKey(value: unknown): Promise<AgentProviderSummary> {
    const providerId = requireText(value, "Provider id is required");
    const runtime = await this.getModelRuntime();
    const provider = runtime.getProvider(providerId);
    if (!provider?.auth.apiKey) {
      throw new Error("Provider does not support API key setup");
    }
    await runtime.logout(providerId);
    return summarizeProvider(
      provider,
      runtime.getProviderAuthStatus(providerId).configured,
    );
  }

  /** Add a custom provider entry to the agent's models.json. */
  async addCustomProvider(value: unknown): Promise<AgentProviderSummary> {
    const input = validateCustomProvider(value);
    const runtime = await this.getModelRuntime();
    if (runtime.getProvider(input.id)) {
      throw new Error(`Provider "${input.id}" already exists`);
    }

    const modelsPath = join(getAgentDir(), "models.json");
    let config: Record<string, unknown> = {};
    try {
      const parsed = asObject(JSON.parse(await readFile(modelsPath, "utf-8")));
      if (!parsed) throw new Error("models.json must contain an object");
      config = { ...parsed };
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }

    const providers: Record<string, unknown> = {
      ...(asObject(config.providers) ?? {}),
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

  /** Stop every active Pi session owned by this manager. */
  stopAll(): void {
    for (const record of this.sessions.values()) this.disposeRecord(record);
  }

  private emit(event: AgentManagerEvent): void {
    this.onEvent?.(event);
  }

  private emitSessionUpdate(record: SessionRecord): void {
    this.emit({ type: "session_update", session: summary(record) });
  }

  private setStatus(record: SessionRecord, status: AgentStatus): void {
    record.status = status;
    record.lastActivity = new Date().toISOString();
    this.emitSessionUpdate(record);
  }

  private failRecord(record: SessionRecord, error: unknown): void {
    record.waiting = undefined;
    this.setStatus(record, "error");
    this.emit({
      type: "session_event",
      sessionId: record.id,
      event: {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  private getModelRuntime(): Promise<ModelRuntime> {
    this.modelRuntimePromise ??= this.injectedModelRuntime
      ? Promise.resolve(this.injectedModelRuntime)
      : ModelRuntime.create();
    return this.modelRuntimePromise;
  }

  private insertRecord(id: string, cwd: string): SessionRecord {
    const record: SessionRecord = {
      id,
      cwd,
      title: "new task",
      status: "idle",
      active: false,
      opened: false,
      settled: true,
      lastActivity: new Date().toISOString(),
      pendingFeedback: new Map(),
    };
    this.sessions.set(record.id, record);
    return record;
  }

  private getRecord(id: unknown): SessionRecord {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Session id is required");
    }
    const record = this.sessions.get(id);
    if (!record) throw new Error("Session was not found");
    return record;
  }

  /** Merge Pi's persisted session files into the in-memory session list. */
  private async refreshPersistedSessions(): Promise<void> {
    const persisted = await SessionManager.listAll();
    const persistedPaths = new Set(persisted.map((info) => info.path));

    for (const info of persisted) {
      const existing = [...this.sessions.values()].find(
        (record) => record.path === info.path || record.piSessionId === info.id,
      );
      if (existing) {
        existing.path = info.path;
        existing.piSessionId = info.id;
        existing.name = info.name;
        if (!existing.session) existing.title = titleForSession(info);
        existing.lastActivity = info.modified.toISOString();
        continue;
      }

      const record = this.insertRecord(info.id, info.cwd);
      record.path = info.path;
      record.piSessionId = info.id;
      record.name = info.name;
      record.title = titleForSession(info);
      record.lastActivity = info.modified.toISOString();
    }

    for (const [id, record] of this.sessions) {
      if (!record.active && record.path && !persistedPaths.has(record.path)) {
        this.sessions.delete(id);
      }
    }
  }

  private ensureSession(record: SessionRecord): Promise<void> {
    if (record.session) return Promise.resolve();
    record.starting ??= this.startSession(record).finally(() => {
      record.starting = undefined;
    });
    return record.starting;
  }

  /** Create the in-process Pi session and publish its history and state. */
  private async startSession(record: SessionRecord): Promise<void> {
    record.status = "starting";
    this.emitSessionUpdate(record);

    try {
      const sessionManager =
        record.sessionManager ??
        (record.path
          ? SessionManager.open(record.path)
          : SessionManager.create(record.cwd));
      record.sessionManager = undefined;
      const modelRuntime = await this.getModelRuntime();
      const { session } = await this.createSession({
        cwd: record.cwd,
        sessionManager,
        modelRuntime,
      });
      record.session = session;
      record.piSessionId = session.sessionId;
      record.path = session.sessionFile;
      record.active = true;
      record.settled = !session.isStreaming;
      record.unsubscribe = session.subscribe((event) =>
        this.handleSessionEvent(record, event),
      );
      await session.bindExtensions({
        mode: "rpc",
        uiContext: this.createUiContext(record),
      });
      if (record.session !== session) return;

      this.emitHistory(record);
      await this.emitState(record);
      if (!record.waiting && record.status === "starting") {
        this.setStatus(record, "ready");
      }
      if (!record.opened) this.disposeRecord(record);
    } catch (error) {
      // A failure after session creation (for example while binding
      // extensions) still needs to release the session and its subscription.
      this.disposeRecord(record);
      this.failRecord(record, error);
      throw error;
    }
  }

  private handleSessionEvent(
    record: SessionRecord,
    event: AgentSessionEvent,
  ): void {
    record.lastActivity = new Date().toISOString();

    switch (event.type) {
      case "agent_start":
        record.settled = false;
        record.waiting = undefined;
        this.setStatus(record, "running");
        break;
      case "tool_execution_start":
      case "tool_execution_update":
        record.settled = false;
        if (!record.waiting) this.setStatus(record, "running");
        break;
      case "agent_settled":
        record.settled = true;
        record.waiting = undefined;
        this.setStatus(record, "idle");
        if (!record.opened) this.disposeRecord(record);
        break;
      case "thinking_level_changed":
        void this.emitState(record);
        break;
      case "session_info_changed":
        record.name = event.name;
        if (event.name) record.title = event.name;
        this.emitSessionUpdate(record);
        break;
      default:
        break;
    }

    this.emit({ type: "session_event", sessionId: record.id, event });
  }

  private emitHistory(record: SessionRecord): void {
    const items = compactAgentHistory(record.session?.messages);
    for (let index = 0; index < items.length; index += HISTORY_CHUNK_SIZE) {
      this.emit({
        type: "session_history",
        sessionId: record.id,
        items: items.slice(index, index + HISTORY_CHUNK_SIZE),
      });
    }
  }

  private async emitState(record: SessionRecord): Promise<void> {
    const session = record.session;
    const modelRuntime = await this.getModelRuntime();
    const available = await modelRuntime.getAvailable();
    if (record.session !== session) return;

    const state: AgentSessionState = {
      models: available.map((model) => ({
        provider: model.provider,
        id: model.id,
        name: model.name,
      })),
      selectedModel: session?.model
        ? `${session.model.provider}/${session.model.id}`
        : "",
      thinkingLevel: session?.thinkingLevel ?? "medium",
      thinkingLevels: session ? [...session.getAvailableThinkingLevels()] : [],
    };
    this.emit({ type: "session_state", sessionId: record.id, state });
  }

  private disposeRecord(record: SessionRecord): void {
    const session = record.session;
    if (!session) return;

    record.session = undefined;
    record.active = false;
    record.unsubscribe?.();
    record.unsubscribe = undefined;
    for (const resolve of record.pendingFeedback.values()) {
      resolve(undefined);
    }
    record.waiting = undefined;
    session.dispose();
    if (record.status !== "error") this.setStatus(record, "idle");
  }

  private validateFeedbackResponse(
    value: unknown,
    record: SessionRecord,
  ): AgentFeedbackResponse {
    if (!isFeedbackResponse(value)) {
      throw new Error("Invalid feedback response");
    }
    if (!record.waiting || record.waiting.id !== value.id) {
      throw new Error("Feedback request is no longer pending");
    }
    if ("cancelled" in value && value.cancelled === true) return value;

    if (
      record.waiting.method === "confirm" &&
      typeof (value as { confirmed?: unknown }).confirmed !== "boolean"
    ) {
      throw new Error("Confirmation response is invalid");
    }
    if (
      record.waiting.method !== "confirm" &&
      typeof (value as { value?: unknown }).value !== "string"
    ) {
      throw new Error("Input response is invalid");
    }
    return value;
  }

  /** Resolve one extension dialog through the renderer. */
  private openFeedback(
    record: SessionRecord,
    request: AgentFeedbackPayload,
    options?: { signal?: AbortSignal; timeout?: number },
  ): Promise<string | boolean | undefined> {
    const id = randomUUID();
    const pending: AgentFeedbackRequest = { ...request, id };
    return new Promise((resolve) => {
      const finish = (value: string | boolean | undefined) => {
        if (!record.pendingFeedback.delete(id)) return;
        // A timeout or abort dismisses the renderer dialog as well.
        if (record.waiting?.id === id) {
          record.waiting = undefined;
          this.setStatus(record, record.settled ? "idle" : "running");
        }
        resolve(value);
      };
      record.pendingFeedback.set(id, finish);
      if (options?.timeout !== undefined) {
        setTimeout(() => finish(undefined), options.timeout);
      }
      options?.signal?.addEventListener("abort", () => finish(undefined), {
        once: true,
      });
      record.waiting = pending;
      record.settled = false;
      this.setStatus(record, "waiting");
      this.emit({
        type: "feedback_request",
        sessionId: record.id,
        request: pending,
      });
    });
  }

  /**
   * Pi extension UI context for a session.
   *
   * Dialogs map to renderer feedback requests. Terminal-only capabilities
   * (widgets, custom components, themes) are inert in the desktop UI.
   */
  private createUiContext(record: SessionRecord): ExtensionUIContext {
    const feedback = (
      request: AgentFeedbackPayload,
      options?: { signal?: AbortSignal; timeout?: number },
    ) => this.openFeedback(record, request, options);

    return {
      select: async (title, options, dialog) => {
        const value = await feedback(
          {
            method: "select",
            title,
            options,
            ...(dialog?.timeout !== undefined
              ? { timeout: dialog.timeout }
              : {}),
          },
          dialog,
        );
        return typeof value === "string" ? value : undefined;
      },
      confirm: async (title, message, dialog) => {
        const value = await feedback(
          {
            method: "confirm",
            title,
            message,
            ...(dialog?.timeout !== undefined
              ? { timeout: dialog.timeout }
              : {}),
          },
          dialog,
        );
        return value === true;
      },
      input: async (title, placeholder, dialog) => {
        const value = await feedback(
          {
            method: "input",
            title,
            ...(placeholder !== undefined ? { placeholder } : {}),
            ...(dialog?.timeout !== undefined
              ? { timeout: dialog.timeout }
              : {}),
          },
          dialog,
        );
        return typeof value === "string" ? value : undefined;
      },
      editor: async (title, prefill) => {
        const value = await feedback({
          method: "editor",
          title,
          ...(prefill !== undefined ? { prefill } : {}),
        });
        return typeof value === "string" ? value : undefined;
      },
      notify: () => {},
      onTerminalInput: () => () => {},
      setStatus: () => {},
      setWorkingMessage: () => {},
      setWorkingVisible: () => {},
      setWorkingIndicator: () => {},
      setHiddenThinkingLabel: () => {},
      setWidget: () => {},
      setFooter: () => {},
      setHeader: () => {},
      setTitle: () => {},
      custom: async () => {
        throw new Error("Custom extension components are not supported");
      },
      pasteToEditor: () => {},
      setEditorText: () => {},
      getEditorText: () => "",
      addAutocompleteProvider: () => {},
      setEditorComponent: () => {},
      getEditorComponent: () => undefined,
      // Terminal theme data has no meaning for the desktop renderer.
      theme: undefined as unknown as Theme,
      getAllThemes: () => [],
      getTheme: () => undefined,
      setTheme: () => ({ success: false, error: "Themes are not supported" }),
      getToolsExpanded: () => false,
      setToolsExpanded: () => {},
    };
  }
}
