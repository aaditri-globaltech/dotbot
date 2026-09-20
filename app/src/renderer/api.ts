import type {
  AgentCommand,
  AgentCustomProviderInput,
  AgentFeedbackResponse,
  AgentManagerEvent,
  AgentProviderSummary,
  AgentSessionState,
  AgentSessionSummary,
  AgentStreamingBehavior,
} from "@dotbot/agent-core";
import type { FileEntry } from "@dotbot/files";
import type { GitStatus } from "@dotbot/git";
import type { UsageStats } from "../shared/usage-stats";

/** Filesystem change batch reported for the watched project. */
export type FilesChanged = {
  projectDir: string;
  paths: string[];
};

/** Inputs for reading a new task's model and thinking defaults. */
export type AgentDefaultsInput = {
  cwd: string;
  /** Preview another available model's thinking levels. */
  provider?: string;
  modelId?: string;
};

/** Renderer-safe API exposed by the isolated Electron preload. */
export interface DotbotApi {
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
    list: () => Promise<AgentSessionSummary[]>;
    defaults: (input: AgentDefaultsInput) => Promise<AgentSessionState>;
    create: (cwd: string) => Promise<AgentSessionSummary>;
    open: (sessionId: string) => Promise<AgentSessionSummary>;
    close: (sessionId: string) => Promise<void>;
    remove: (sessionId: string) => Promise<void>;
    prompt: (
      sessionId: string,
      message: string,
      streamingBehavior?: AgentStreamingBehavior,
    ) => Promise<void>;
    abort: (sessionId: string) => Promise<void>;
    command: (sessionId: string, command: AgentCommand) => Promise<void>;
    respond: (
      sessionId: string,
      response: AgentFeedbackResponse,
    ) => Promise<void>;
    onEvent: (listener: (event: AgentManagerEvent) => void) => () => void;
  };
  /** Provider listing and API key management. */
  providers: {
    list: () => Promise<AgentProviderSummary[]>;
    setKey: (
      providerId: string,
      apiKey: string,
    ) => Promise<AgentProviderSummary>;
    remove: (providerId: string) => Promise<AgentProviderSummary>;
    add: (provider: AgentCustomProviderInput) => Promise<AgentProviderSummary>;
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
export const api: DotbotApi = globalThis.window?.dotbot as DotbotApi;
