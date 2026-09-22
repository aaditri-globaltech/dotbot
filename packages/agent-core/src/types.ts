/**
 * App-facing contract between Dotbot's Electron main process and its renderer.
 *
 * These types describe only what the desktop UI renders. Raw Pi session events
 * are forwarded unchanged as `AgentSessionEvent` (re-exported by the facade).
 */

import type {
  ImageContent,
  ModelThinkingLevel,
  TextContent,
} from "@earendil-works/pi-ai";
import type {
  AgentSessionEvent,
  ProjectTrustStoreEntry,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

export type { ModelThinkingLevel };

/** Lifecycle state reported for a session. */
export type SessionStatus =
  | "starting"
  | "running"
  | "waiting"
  | "idle"
  | "error";

/** Model advertised by Pi for the active session. */
export type ModelSummary = {
  provider: string;
  id: string;
  name: string;
};

/** Pi provider that can be configured with an API key. */
export type ProviderSummary = {
  id: string;
  name: string;
  configured: boolean;
};

/** API protocols Pi supports for custom providers. */
export const PROVIDER_APIS = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
] as const;

export type ProviderApi = (typeof PROVIDER_APIS)[number];

/** Fields Dotbot writes for a custom provider in models.json. */
export type CustomProviderInput = {
  id: string;
  baseUrl: string;
  api: ProviderApi;
  models: string[];
};

/** How a prompt sent during a running turn is queued. */
export type StreamingBehavior = "steer" | "followUp";

/** Extension dialog opened by an extension. */
export type ExtensionRequestPayload =
  | {
      method: "select";
      title: string;
      options: string[];
      timeout?: number;
    }
  | {
      method: "confirm";
      title: string;
      message: string;
      timeout?: number;
    }
  | {
      method: "input";
      title: string;
      placeholder?: string;
      timeout?: number;
    }
  | {
      method: "editor";
      title: string;
      prefill?: string;
    };

/** Extension request with the manager-generated id. */
export type ExtensionRequest = ExtensionRequestPayload & { id: string };

/** Response sent to the pending extension request. */
export type ExtensionResponse =
  | { type: "extension_ui_response"; id: string; value: string }
  | { type: "extension_ui_response"; id: string; confirmed: boolean }
  | { type: "extension_ui_response"; id: string; cancelled: true };

/** A saved project trust decision from trust.json. */
export type TrustDecisionEntry = ProjectTrustStoreEntry;

/** Trust dialog request with the manager-generated id. */
export type TrustRequest = ExtensionRequest;

/** Session summary returned by manager events. */
export type SessionSummary = {
  /** Dotbot's session identifier used in event payloads. */
  id: string;
  /** Project directory in which Pi runs. */
  projectDir: string;
  /** Fallback or persisted display title. */
  title: string;
  /** Optional name assigned by Pi. */
  name?: string;
  /** Current turn state. */
  status: SessionStatus;
  /** Whether an in-process Pi session is currently active. */
  active: boolean;
  /** Pending extension request, when status is `waiting`. */
  waiting?: ExtensionRequest;
  /** Renderer-owned unread marker. */
  unread: boolean;
  /** ISO timestamp of the latest observed activity. */
  lastActivity: string;
};

/** Model and thinking selections for one session. */
export type SessionControls = {
  models: ModelSummary[];
  /** `provider/id` of the active model; empty when no model is selected. */
  selectedModel: string;
  thinkingLevel: ModelThinkingLevel;
  thinkingLevels: ModelThinkingLevel[];
};

/** Inputs for reading a project's session controls without creating a session. */
export type SessionControlsInput = {
  projectDir: string;
  /** Preview another available model's thinking levels. */
  provider?: string;
  modelId?: string;
};

/** Normalized user or assistant chat message. */
export type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

/** Normalized tool invocation and its streamed result. */
export type ToolCall = {
  kind: "tool";
  id: string;
  name: string;
  arguments: string;
  output: string;
  status: "streaming" | "running" | "done" | "error";
};

/** Normalized streamed thinking block. */
export type ThinkingBlock = {
  kind: "thinking";
  id: string;
  text: string;
  status: "streaming" | "done";
};

/** Transcript notice for a session failure reported by the manager. */
export type ErrorNotice = {
  kind: "error";
  id: string;
  text: string;
};

/** One user-run bash command with its streamed output. */
export type BashExecution = {
  kind: "bash";
  id: string;
  command: string;
  excludeFromContext: boolean;
  output: string;
  truncated: boolean;
  fullOutputPath?: string;
  exitCode?: number;
  status: "running" | "done" | "error" | "cancelled";
};

/** One renderable item in a compacted session transcript. */
export type TranscriptItem =
  | TranscriptMessage
  | ToolCall
  | ThinkingBlock
  | BashExecution
  | ErrorNotice;

/** Result of one UI-driven bash command. Mirrors Pi's internal BashResult. */
export type BashResult = {
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
};

/** Tool selection applied when a session starts. */
export type SessionCreateOptions = {
  tools?: string[];
  excludeTools?: string[];
  noTools?: "all" | "builtin";
  customTools?: ToolDefinition[];
};

/** Message an agent consumer injects into the session transcript. */
export type CustomMessageInput = {
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display?: boolean;
  details?: unknown;
};

/** How a custom message enters a running turn. */
export type CustomMessageDelivery = {
  triggerTurn?: boolean;
  deliverAs?: "steer" | "followUp" | "nextTurn";
};

/** Pending steering and follow-up messages for one session. */
export type SessionQueue = {
  steering: string[];
  followUp: string[];
  pendingCount: number;
};

/** Events published by the agent manager to the renderer. */
export type AgentManagerEvent =
  | { type: "session_update"; session: SessionSummary }
  | { type: "session_controls"; sessionId: string; controls: SessionControls }
  | {
      type: "session_activity";
      sessionId: string;
      event: AgentSessionEvent;
    }
  | { type: "session_transcript"; sessionId: string; items: TranscriptItem[] }
  | { type: "session_error"; sessionId: string; message: string }
  | {
      type: "extension_error";
      sessionId: string;
      extensionPath: string;
      event: string;
      message: string;
    }
  | {
      type: "extension_request";
      sessionId: string;
      request: ExtensionRequest;
    }
  | { type: "trust_request"; request: TrustRequest }
  | { type: "trust_update"; projectDir: string; decision: boolean };
