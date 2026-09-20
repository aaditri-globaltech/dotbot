import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AgentManager,
  type AgentManagerEvent,
  getSessionsDir,
  ProviderRegistry,
} from "@dotbot/agent-core";
import { asRecord } from "@dotbot/agent-core/text";
import { readDirectory, watchDirectory } from "@dotbot/files";
import {
  type GitStatus,
  gitCommit,
  gitStage,
  gitStatus,
  gitUnstage,
} from "@dotbot/git";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from "electron";
import { createFileWatch } from "./file-watch";
import { UsageStatsStore } from "./usage-stats";

const directory = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let isQuitting = false;

const agentManager = new AgentManager({ onEvent: sendEvent });
const providers = new ProviderRegistry(() => agentManager.getModelRuntime());

const usageStats = new UsageStatsStore({
  sessionsRoot: getSessionsDir(),
  storePath: join(app.getPath("userData"), "usage-stats.json"),
});

const fileWatch = createFileWatch(watchDirectory);

/** Forward a message only while a renderer window is available. */
function sendToRenderer(channel: string, payload: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function sendEvent(event: AgentManagerEvent) {
  sendToRenderer("agent:event", event);
}

/** Embedded PNG keeps the tray icon visible on Linux Electron builds. */
const trayIcon = nativeImage.createFromDataURL(
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAZklEQVR4nO3TyxEAEBADUJVoQ1eqUY/WKAAj2LE+yUxuyLsw1sekWXMMwIW0tQQQsAyohYA/AK3BUQgBwwB0AD13NwCNCEAi7wDQn4Lc6wJmh9F3CGgCpIZ7kHMBu0oAAQVAq+qADE+tTCWSUYUnAAAAAElFTkSuQmCC",
);

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
}

/** Keep the process alive while the window is hidden and expose restore/quit actions. */
function createTray() {
  tray = new Tray(trayIcon);
  tray.setToolTip("Dotbot");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Dotbot", click: showMainWindow },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  tray.on("click", toggleMainWindow);
}

/** Create the isolated renderer and choose dev-server or packaged assets. */
function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload:
        process.env.ELECTRON_PRELOAD_PATH ??
        join(directory, "../preload/preload.cjs"),
    },
  });
  mainWindow = window;
  // Closing the window hides it; only the tray's Quit action ends the process.
  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });

  const syncMaximizedState = () =>
    window.webContents.send("window:maximized", window.isMaximized());
  window.on("maximize", syncMaximizedState);
  window.on("unmaximize", syncMaximizedState);
  window.webContents.on("did-finish-load", syncMaximizedState);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(directory, "../index.html"));
  }
}

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("window:toggle-maximize", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
});

ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("agent:list", () => agentManager.list());
ipcMain.handle("agent:controls", (_event, value: unknown) =>
  agentManager.getSessionControls(value),
);
ipcMain.handle("agent:create", (_event, projectDir: unknown) =>
  agentManager.create(projectDir),
);
ipcMain.handle("agent:open", (_event, id: unknown) => agentManager.open(id));
ipcMain.handle("agent:close", (_event, id: unknown) => {
  agentManager.close(id);
});
ipcMain.handle("agent:discard", (_event, id: unknown) => {
  agentManager.discard(id);
});
ipcMain.handle("agent:prompt", (_event, value: unknown) =>
  agentManager.prompt(value),
);
ipcMain.handle("agent:abort", (_event, id: unknown) => {
  agentManager.abort(id);
});
ipcMain.handle("agent:set-model", (_event, value: unknown) =>
  agentManager.setModel(value),
);
ipcMain.handle("agent:set-thinking-level", (_event, value: unknown) =>
  agentManager.setThinkingLevel(value),
);
ipcMain.handle("agent:respond", (_event, value: unknown) => {
  agentManager.respond(value);
});

ipcMain.handle("providers:list", () => providers.list());
ipcMain.handle("providers:set-key", (_event, value: unknown) =>
  providers.setApiKey(value),
);
ipcMain.handle("providers:remove", (_event, id: unknown) =>
  providers.removeApiKey(id),
);
ipcMain.handle("providers:add", (_event, value: unknown) =>
  providers.addCustom(value),
);

ipcMain.handle("stats:get", () => usageStats.computeStats());

// Project picking uses the native dialog; file reads and Git stay in packages.
ipcMain.handle("project:pick", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open project",
    properties: ["openDirectory"],
  });
  return result.canceled ? undefined : result.filePaths[0];
});

// Only the active project is watched; fileWatch serializes replacement.
ipcMain.handle("files:watch", (_event, projectDir: unknown) =>
  fileWatch.watch(
    projectDir,
    (paths) => sendToRenderer("files:changed", { projectDir, paths }),
    (error: unknown) => {
      // Watch failures leave the manual refresh buttons as the fallback.
      console.error("File watcher failed:", error);
    },
  ),
);

ipcMain.handle("files:unwatch", () => fileWatch.stop());

ipcMain.handle("files:read-directory", (_event, value: unknown) => {
  const input = asRecord(value);
  return readDirectory(input?.projectDir, input?.path);
});

ipcMain.handle(
  "git:status",
  (_event, projectDir: unknown): Promise<GitStatus> => gitStatus(projectDir),
);

ipcMain.handle("git:stage", (_event, value: unknown) => {
  const input = asRecord(value);
  return gitStage(input?.projectDir, input?.path);
});

ipcMain.handle("git:unstage", (_event, value: unknown) => {
  const input = asRecord(value);
  return gitUnstage(input?.projectDir, input?.path);
});

ipcMain.handle("git:commit", (_event, value: unknown) => {
  const input = asRecord(value);
  return gitCommit(input?.projectDir, input?.message);
});

app.on("before-quit", () => {
  isQuitting = true;
  void fileWatch.stop();
  // Agent sessions run in-process, so shutdown only needs to dispose them.
  agentManager.stopAll();
});

void app
  .whenReady()
  .then(() => {
    createTray();
    createWindow();
    app.on("activate", showMainWindow);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Dotbot failed to start:", message);
    app.exit(1);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
