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
import type { GitStatus } from "@dotbot/source-control";
import type { ExplorerEntry } from "@dotbot/workspace";
import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentDefaultsInput,
  DotbotApi,
  WorkspaceChange,
} from "../renderer/api";
import type { ActivityStatsResult } from "../shared/activity-stats";

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
  activity: {
    getStats: () =>
      ipcRenderer.invoke("activity:get-stats") as Promise<ActivityStatsResult>,
  },
  // Filesystem and Git operations stay in the main process behind validated IPC.
  workspace: {
    pick: () =>
      ipcRenderer.invoke("workspace:pick") as Promise<string | undefined>,
    readDirectory: (cwd: string, path = "") =>
      ipcRenderer.invoke("workspace:read-directory", { cwd, path }) as Promise<
        ExplorerEntry[]
      >,
    watch: (cwd: string) => ipcRenderer.invoke("workspace:watch", cwd),
    unwatch: () => ipcRenderer.invoke("workspace:unwatch"),
    onChanged: (listener: (change: WorkspaceChange) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        change: WorkspaceChange,
      ) => listener(change);
      ipcRenderer.on("workspace:changed", handler);
      return () => ipcRenderer.removeListener("workspace:changed", handler);
    },
    gitStatus: (cwd: string) =>
      ipcRenderer.invoke("workspace:git-status", cwd) as Promise<GitStatus>,
    gitStage: (cwd: string, path: string) =>
      ipcRenderer.invoke("workspace:git-stage", { cwd, path }) as Promise<void>,
    gitUnstage: (cwd: string, path: string) =>
      ipcRenderer.invoke("workspace:git-unstage", {
        cwd,
        path,
      }) as Promise<void>,
    gitCommit: (cwd: string, message: string) =>
      ipcRenderer.invoke("workspace:git-commit", {
        cwd,
        message,
      }) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld("dotbot", api);
