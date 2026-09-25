import type {
  AgentManagerEvent,
  BashResult,
  CompactionResult,
  ContextUsage,
  CustomMessageDelivery,
  CustomMessageInput,
  CustomProviderInput,
  DefaultProjectTrust,
  ExtensionResponse,
  ImageContent,
  ModelThinkingLevel,
  ProviderSummary,
  SessionControls,
  SessionControlsInput,
  SessionCreateOptions,
  SessionQueue,
  SessionStats,
  SessionSummary,
  StreamingBehavior,
  TrustDecisionEntry,
} from "@dotbot/agent-core";
import type { FileEntry } from "@dotbot/files";
import type { GitStatus } from "@dotbot/git";
import type { UsageStats } from "../shared/usage-stats";

/** Filesystem change batch reported for the watched project. */
export type FilesChanged = {
  projectDir: string;
  paths: string[];
};

/** Renderer-safe API exposed by the isolated Electron preload. */
export interface BotApi {
  /** Basic bridge health check. */
  ping: () => string;
  /** Native window controls and maximized-state subscription. */
  window: {
    close: () => void;
    minimize: () => void;
    toggleMaximize: () => void;
    onMaximizedChange: (listener: (maximized: boolean) => void) => () => void;
  };
  /** Agent session lifecycle, prompts, controls, and streamed events. */
  agent: {
    list: () => Promise<SessionSummary[]>;
    controls: (input: SessionControlsInput) => Promise<SessionControls>;
    create: (
      projectDir: string,
      options?: Pick<
        SessionCreateOptions,
        "tools" | "excludeTools" | "noTools"
      >,
    ) => Promise<SessionSummary>;
    open: (sessionId: string) => Promise<SessionSummary>;
    close: (sessionId: string) => Promise<void>;
    discard: (sessionId: string) => Promise<void>;
    prompt: (
      sessionId: string,
      message: string,
      streamingBehavior?: StreamingBehavior,
      images?: ImageContent[],
    ) => Promise<void>;
    abort: (sessionId: string) => Promise<void>;
    setModel: (
      sessionId: string,
      provider: string,
      modelId: string,
    ) => Promise<void>;
    setThinkingLevel: (
      sessionId: string,
      level: ModelThinkingLevel,
    ) => Promise<void>;
    respond: (sessionId: string, response: ExtensionResponse) => Promise<void>;
    respondTrust: (response: ExtensionResponse) => Promise<void>;
    setSessionName: (sessionId: string, name: string) => Promise<void>;
    compact: (
      sessionId: string,
      customInstructions?: string,
    ) => Promise<CompactionResult>;
    abortCompaction: (sessionId: string) => Promise<void>;
    stats: (sessionId: string) => Promise<SessionStats | undefined>;
    contextUsage: (sessionId: string) => Promise<ContextUsage | undefined>;
    executeBash: (
      sessionId: string,
      command: string,
      options?: { excludeFromContext?: boolean; id?: string },
    ) => Promise<BashResult>;
    abortBash: (sessionId: string) => Promise<void>;
    setActiveTools: (sessionId: string, tools: string[]) => Promise<void>;
    sendCustomMessage: (
      sessionId: string,
      message: CustomMessageInput,
      options?: CustomMessageDelivery,
    ) => Promise<void>;
    queue: (sessionId: string) => Promise<SessionQueue>;
    clearQueue: (
      sessionId: string,
    ) => Promise<{ steering: string[]; followUp: string[] }>;
    onEvent: (listener: (event: AgentManagerEvent) => void) => () => void;
  };
  /** Provider listing and API key management. */
  providers: {
    list: () => Promise<ProviderSummary[]>;
    setKey: (providerId: string, apiKey: string) => Promise<ProviderSummary>;
    remove: (providerId: string) => Promise<ProviderSummary>;
    add: (provider: CustomProviderInput) => Promise<ProviderSummary>;
  };
  /** Project trust defaults and saved decisions. */
  trust: {
    getDefault: () => Promise<DefaultProjectTrust>;
    setDefault: (value: DefaultProjectTrust) => Promise<void>;
    list: () => Promise<TrustDecisionEntry[]>;
    revoke: (path: string) => Promise<void>;
  };
  /** Dashboard usage statistics derived from persisted sessions. */
  stats: {
    get: () => Promise<UsageStats>;
  };
  /** Project picking, file tree access, and Git operations. */
  projects: {
    pick: () => Promise<string | undefined>;
  };
  files: {
    readDirectory: (projectDir: string, path?: string) => Promise<FileEntry[]>;
    watch: (projectDir: string) => Promise<void>;
    unwatch: () => Promise<void>;
    onChanged: (listener: (change: FilesChanged) => void) => () => void;
  };
  git: {
    status: (projectDir: string) => Promise<GitStatus>;
    stage: (projectDir: string, path: string) => Promise<void>;
    unstage: (projectDir: string, path: string) => Promise<void>;
    commit: (projectDir: string, message: string) => Promise<void>;
  };
}

/** Typed reference to the preload bridge used by renderer components. */
export const api: BotApi = globalThis.window?.dotbot as BotApi;
