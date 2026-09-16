import type {
  AgentCommand,
  AgentFeedbackResponse,
  AgentManagerEvent,
  AgentSessionSummary,
  AgentStreamingBehavior,
} from "@dotbot/agent-core";
import type { GitStatus } from "@dotbot/source-control";
import type { ExplorerEntry } from "@dotbot/workspace";

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
    create: (cwd: string) => Promise<AgentSessionSummary>;
    open: (sessionId: string) => Promise<AgentSessionSummary>;
    close: (sessionId: string) => Promise<void>;
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
  /** Workspace picker, Explorer, and Git operations. */
  workspace: {
    pick: () => Promise<string | undefined>;
    readDirectory: (cwd: string, path?: string) => Promise<ExplorerEntry[]>;
    gitStatus: (cwd: string) => Promise<GitStatus>;
    gitStage: (cwd: string, path: string) => Promise<void>;
    gitUnstage: (cwd: string, path: string) => Promise<void>;
    gitCommit: (cwd: string, message: string) => Promise<void>;
  };
}

/** Typed reference to the preload bridge used by renderer components. */
export const api: DotbotApi = globalThis.window?.dotbot as DotbotApi;
