// Keep Node and Electron APIs in the isolated preload; the renderer receives
// only the narrow, typed operations it needs through contextBridge.

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
import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentDefaultsInput,
  DotbotApi,
  FilesChanged,
} from "../renderer/api";
import type { UsageStats } from "../shared/usage-stats";

const api: DotbotApi = {
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
    list: () =>
      ipcRenderer.invoke("agent:list") as Promise<AgentSessionSummary[]>,
    defaults: (input: AgentDefaultsInput) =>
      ipcRenderer.invoke("agent:defaults", input) as Promise<AgentSessionState>,
    create: (cwd: string) =>
      ipcRenderer.invoke("agent:create", cwd) as Promise<AgentSessionSummary>,
    open: (sessionId: string) =>
      ipcRenderer.invoke(
        "agent:open",
        sessionId,
      ) as Promise<AgentSessionSummary>,
    close: (sessionId: string) => ipcRenderer.invoke("agent:close", sessionId),
    remove: (sessionId: string) =>
      ipcRenderer.invoke("agent:remove", sessionId),
    prompt: (
      sessionId: string,
      message: string,
      streamingBehavior?: AgentStreamingBehavior,
    ) =>
      ipcRenderer.invoke("agent:prompt", {
        sessionId,
        message,
        ...(streamingBehavior ? { streamingBehavior } : {}),
      }),
    abort: (sessionId: string) => ipcRenderer.invoke("agent:abort", sessionId),
    command: (sessionId: string, command: AgentCommand) =>
      ipcRenderer.invoke("agent:command", { sessionId, command }),
    respond: (sessionId: string, response: AgentFeedbackResponse) =>
      ipcRenderer.invoke("agent:respond", { sessionId, response }),
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
      ipcRenderer.invoke("providers:list") as Promise<AgentProviderSummary[]>,
    setKey: (providerId: string, apiKey: string) =>
      ipcRenderer.invoke("providers:set-key", {
        providerId,
        apiKey,
      }) as Promise<AgentProviderSummary>,
    remove: (providerId: string) =>
      ipcRenderer.invoke(
        "providers:remove",
        providerId,
      ) as Promise<AgentProviderSummary>,
    add: (provider: AgentCustomProviderInput) =>
      ipcRenderer.invoke(
        "providers:add",
        provider,
      ) as Promise<AgentProviderSummary>,
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
