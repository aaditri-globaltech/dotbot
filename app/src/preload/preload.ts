// Keep Node and Electron APIs in the isolated preload; the renderer receives
// only the narrow, typed operations it needs through contextBridge.

import type {
  AgentManagerEvent,
  CustomProviderInput,
  DefaultProjectTrust,
  ExtensionResponse,
  ModelThinkingLevel,
  ProviderSummary,
  SessionControls,
  SessionControlsInput,
  SessionSummary,
  StreamingBehavior,
  TrustDecisionEntry,
} from "@dotbot/agent-core";
import type { FileEntry } from "@dotbot/files";
import type { GitStatus } from "@dotbot/git";
import { contextBridge, ipcRenderer } from "electron";
import type { BotApi, FilesChanged } from "../renderer/api";
import type { UsageStats } from "../shared/usage-stats";

const api: BotApi = {
  ping: () => "pong",
  window: {
    close: () => ipcRenderer.send("window:close"),
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    onMaximizedChange: (listener: (maximized: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
        listener(maximized);
      ipcRenderer.on("window:maximized", handler);
      return () => ipcRenderer.removeListener("window:maximized", handler);
    },
  },
  // IPC channels are wrapped instead of exposing ipcRenderer directly.
  agent: {
    list: () => ipcRenderer.invoke("agent:list") as Promise<SessionSummary[]>,
    controls: (input: SessionControlsInput) =>
      ipcRenderer.invoke("agent:controls", input) as Promise<SessionControls>,
    create: (projectDir: string) =>
      ipcRenderer.invoke("agent:create", projectDir) as Promise<SessionSummary>,
    open: (sessionId: string) =>
      ipcRenderer.invoke("agent:open", sessionId) as Promise<SessionSummary>,
    close: (sessionId: string) => ipcRenderer.invoke("agent:close", sessionId),
    discard: (sessionId: string) =>
      ipcRenderer.invoke("agent:discard", sessionId),
    prompt: (
      sessionId: string,
      message: string,
      streamingBehavior?: StreamingBehavior,
    ) =>
      ipcRenderer.invoke("agent:prompt", {
        sessionId,
        message,
        ...(streamingBehavior ? { streamingBehavior } : {}),
      }),
    abort: (sessionId: string) => ipcRenderer.invoke("agent:abort", sessionId),
    setModel: (sessionId: string, provider: string, modelId: string) =>
      ipcRenderer.invoke("agent:set-model", {
        sessionId,
        provider,
        modelId,
      }),
    setThinkingLevel: (sessionId: string, level: ModelThinkingLevel) =>
      ipcRenderer.invoke("agent:set-thinking-level", { sessionId, level }),
    respond: (sessionId: string, response: ExtensionResponse) =>
      ipcRenderer.invoke("agent:respond", { sessionId, response }),
    respondTrust: (response: ExtensionResponse) =>
      ipcRenderer.invoke("agent:respond-trust", response),
    onEvent: (listener: (event: AgentManagerEvent) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        event: AgentManagerEvent,
      ) => listener(event);
      ipcRenderer.on("agent:event", handler);
      return () => ipcRenderer.removeListener("agent:event", handler);
    },
  },
  providers: {
    list: () =>
      ipcRenderer.invoke("providers:list") as Promise<ProviderSummary[]>,
    setKey: (providerId: string, apiKey: string) =>
      ipcRenderer.invoke("providers:set-key", {
        providerId,
        apiKey,
      }) as Promise<ProviderSummary>,
    remove: (providerId: string) =>
      ipcRenderer.invoke(
        "providers:remove",
        providerId,
      ) as Promise<ProviderSummary>,
    add: (provider: CustomProviderInput) =>
      ipcRenderer.invoke("providers:add", provider) as Promise<ProviderSummary>,
  },
  trust: {
    getDefault: () =>
      ipcRenderer.invoke("trust:get-default") as Promise<DefaultProjectTrust>,
    setDefault: (value: DefaultProjectTrust) =>
      ipcRenderer.invoke("trust:set-default", value),
    list: () =>
      ipcRenderer.invoke("trust:list") as Promise<TrustDecisionEntry[]>,
    revoke: (path: string) => ipcRenderer.invoke("trust:revoke", path),
  },
  stats: {
    get: () => ipcRenderer.invoke("stats:get") as Promise<UsageStats>,
  },
  // Filesystem and Git operations stay in the main process behind validated IPC.
  projects: {
    pick: () =>
      ipcRenderer.invoke("project:pick") as Promise<string | undefined>,
  },
  files: {
    readDirectory: (projectDir: string, path = "") =>
      ipcRenderer.invoke("files:read-directory", {
        projectDir,
        path,
      }) as Promise<FileEntry[]>,
    watch: (projectDir: string) =>
      ipcRenderer.invoke("files:watch", projectDir),
    unwatch: () => ipcRenderer.invoke("files:unwatch"),
    onChanged: (listener: (change: FilesChanged) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        change: FilesChanged,
      ) => listener(change);
      ipcRenderer.on("files:changed", handler);
      return () => ipcRenderer.removeListener("files:changed", handler);
    },
  },
  git: {
    status: (projectDir: string) =>
      ipcRenderer.invoke("git:status", projectDir) as Promise<GitStatus>,
    stage: (projectDir: string, path: string) =>
      ipcRenderer.invoke("git:stage", { projectDir, path }) as Promise<void>,
    unstage: (projectDir: string, path: string) =>
      ipcRenderer.invoke("git:unstage", {
        projectDir,
        path,
      }) as Promise<void>,
    commit: (projectDir: string, message: string) =>
      ipcRenderer.invoke("git:commit", {
        projectDir,
        message,
      }) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld("dotbot", api);
