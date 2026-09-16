/**
 * Aria's transparent facade over the Pi SDK.
 *
 * Named re-exports expose the session, model, settings, tool, and extension
 * APIs that Aria builds on, alongside the in-process session manager and the
 * app-facing event contract. Pi package names stay inside this package;
 * downstream code uses agent, session, manager, and extension terms.
 */

export type { Api, Model, Provider } from "@earendil-works/pi-ai";
export {
  AgentSession,
  type AgentSessionConfig,
  type AgentSessionEvent,
  type AgentSessionEventListener,
  AgentSessionRuntime,
  CONFIG_DIR_NAME,
  type CreateAgentSessionOptions,
  type CreateAgentSessionResult,
  type CreateModelRuntimeOptions,
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createBashTool,
  createCodingTools,
  createEditTool,
  createEventBus,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadOnlyTools,
  createReadTool,
  createWriteTool,
  DefaultResourceLoader,
  defineTool,
  type EventBus,
  type EventBusController,
  type ExtensionAPI,
  type ExtensionContext,
  type ExtensionFactory,
  type ExtensionUIContext,
  getAgentDir,
  getDocsPath,
  getExamplesPath,
  getPackageDir,
  getReadmePath,
  type InlineExtension,
  ModelRuntime,
  type NewSessionOptions,
  type PromptTemplate,
  type ResourceLoader,
  type SessionInfo,
  SessionManager,
  SettingsManager,
  type SettingsManagerCreateOptions,
  type Skill,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";

export { compactAgentHistory } from "./history";
export {
  AgentSessionManager,
  type AgentSessionManagerOptions,
  type CreateSessionFunction,
} from "./manager";
export type {
  AgentChatItem,
  AgentChatMessage,
  AgentCommand,
  AgentErrorNotice,
  AgentEvent,
  AgentFeedbackPayload,
  AgentFeedbackRequest,
  AgentFeedbackResponse,
  AgentManagerEvent,
  AgentModel,
  AgentSessionState,
  AgentSessionSummary,
  AgentStatus,
  AgentStreamingBehavior,
  AgentThinkingBlock,
  AgentThinkingLevel,
  AgentToolCall,
} from "./types";
