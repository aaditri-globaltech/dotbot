/**
 * Dotbot's transparent facade over the Pi SDK.
 *
 * Named re-exports expose the session, model, settings, tool, and extension
 * APIs that Dotbot builds on, alongside the in-process session manager and the
 * app-facing event contract. Pi package names stay inside this package;
 * downstream code uses agent, session, manager, and extension terms.
 */

export type {
  Api,
  ImageContent,
  Model,
  Provider,
  TextContent,
} from "@earendil-works/pi-ai";
export {
  AgentSession,
  type AgentSessionConfig,
  type AgentSessionEvent,
  type AgentSessionEventListener,
  AgentSessionRuntime,
  CONFIG_DIR_NAME,
  type CompactionResult,
  type ContextUsage,
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
  type DefaultProjectTrust,
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
  type SessionStats,
  SettingsManager,
  type SettingsManagerCreateOptions,
  type Skill,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
export {
  AgentManager,
  type AgentManagerOptions,
  type CreateSessionFunction,
} from "./agent-manager";
export { getSessionsDir } from "./paths";
export { ProviderRegistry } from "./providers";
export { buildTranscript } from "./transcript";
export { TrustManager } from "./trust";
export type {
  AgentManagerEvent,
  BashExecution,
  BashResult,
  CustomMessageDelivery,
  CustomMessageInput,
  CustomProviderInput,
  ErrorNotice,
  ExtensionRequest,
  ExtensionRequestPayload,
  ExtensionResponse,
  ModelSummary,
  ModelThinkingLevel,
  ProviderApi,
  ProviderSummary,
  SessionControls,
  SessionControlsInput,
  SessionCreateOptions,
  SessionQueue,
  SessionStatus,
  SessionSummary,
  StreamingBehavior,
  ThinkingBlock,
  ToolCall,
  TranscriptItem,
  TranscriptMessage,
  TrustDecisionEntry,
  TrustRequest,
} from "./types";
export { PROVIDER_APIS } from "./types";
