/**
 * App-facing contract between Dotbot's Electron main process and its renderer.
 *
 * These types describe only what the desktop UI renders. Raw Pi session events
 * are forwarded unchanged as `AgentSessionEvent` (re-exported by the facade).
 */

import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

/** Lifecycle state reported for an agent session. */
export type AgentStatus =
  | "starting"
  | "ready"
  | "running"
  | "waiting"
  | "idle"
  | "error";

/** Model advertised by Pi for the active session. */
export type AgentModel = {
  provider: string;
  id: string;
  name: string;
};

/** Thinking levels accepted by Pi's `set_thinking_level` command. */
export type AgentThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/** How a prompt sent during a running turn is queued. */
export type AgentStreamingBehavior = "steer" | "followUp";

/** Control command forwarded to the active Pi session. */
export type AgentCommand =
  | { type: "set_model"; provider: string; modelId: string }
  | { type: "set_thinking_level"; level: AgentThinkingLevel };

/** Feedback dialog opened by an extension. */
export type AgentFeedbackPayload =
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

/** Feedback request with the manager-generated id. */
export type AgentFeedbackRequest = AgentFeedbackPayload & { id: string };

/** Response sent to the pending feedback request. */
export type AgentFeedbackResponse =
  | { type: "extension_ui_response"; id: string; value: string }
  | { type: "extension_ui_response"; id: string; confirmed: boolean }
  | { type: "extension_ui_response"; id: string; cancelled: true };

/** Session summary returned by manager events. */
export type AgentSessionSummary = {
  /** Dotbot's session identifier used in event payloads. */
  id: string;
  /** Pi's persisted session identifier, once a session exists. */
  piSessionId?: string;
  /** Workspace directory in which Pi runs. */
  cwd: string;
  /** Fallback or persisted display title. */
  title: string;
  /** Optional name assigned by Pi. */
  name?: string;
  /** Current turn state. */
  status: AgentStatus;
  /** Whether an in-process Pi session is currently active. */
  active: boolean;
  /** Pending feedback request, when status is `waiting`. */
  waiting?: AgentFeedbackRequest;
  /** Renderer-owned unread marker. */
  unread: boolean;
  /** ISO timestamp of the latest observed activity. */
  lastActivity?: string;
};

/** Model and thinking selections for one session. */
export type AgentSessionState = {
  models: AgentModel[];
  /** `provider/id` of the active model; empty when no model is selected. */
  selectedModel: string;
  thinkingLevel: AgentThinkingLevel;
  thinkingLevels: AgentThinkingLevel[];
};

/** Normalized user or assistant chat message. */
export type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

/** Normalized tool invocation and its streamed result. */
export type AgentToolCall = {
  kind: "tool";
  id: string;
  name: string;
  arguments: string;
  output: string;
  status: "streaming" | "running" | "done" | "error";
};

/** Normalized streamed thinking block. */
export type AgentThinkingBlock = {
  kind: "thinking";
  id: string;
  text: string;
  status: "streaming" | "done";
};

/** Transcript notice for a session failure reported by the manager. */
export type AgentErrorNotice = {
  kind: "error";
  id: string;
  text: string;
};

/** One renderable item in a compacted session transcript. */
export type AgentChatItem =
  | AgentChatMessage
  | AgentToolCall
  | AgentThinkingBlock
  | AgentErrorNotice;

/** Raw Pi session event, plus manager-generated failure notices. */
export type AgentEvent = AgentSessionEvent | { type: "error"; message: string };

/** Events published by the session manager to the renderer. */
export type AgentManagerEvent =
  | { type: "sessions"; sessions: AgentSessionSummary[] }
  | { type: "session_update"; session: AgentSessionSummary }
  | { type: "session_state"; sessionId: string; state: AgentSessionState }
  | { type: "session_event"; sessionId: string; event: AgentEvent }
  | { type: "session_history"; sessionId: string; items: AgentChatItem[] }
  | {
      type: "feedback_request";
      sessionId: string;
      request: AgentFeedbackRequest;
    };
