import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AgentManagerEvent,
  AgentSessionManager,
} from "@dotbot/agent-core";
import {
  type GitStatus,
  gitCommit,
  gitStage,
  gitStatus,
  gitUnstage,
} from "@dotbot/source-control";
import { readDirectory } from "@dotbot/workspace";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from "electron";

const directory = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let isQuitting = false;

const sessions = new AgentSessionManager({ onEvent: sendEvent });

/** Forward manager events only while a renderer window is available. */
function sendEvent(event: AgentManagerEvent) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("agent:event", event);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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

ipcMain.handle("agent:list", () => sessions.list());
ipcMain.handle("agent:create", (_event, cwd: unknown) => sessions.create(cwd));
ipcMain.handle("agent:open", (_event, id: unknown) => sessions.open(id));
ipcMain.handle("agent:close", (_event, id: unknown) => {
  sessions.close(id);
});
ipcMain.handle("agent:prompt", (_event, value: unknown) =>
  sessions.prompt(value),
);
ipcMain.handle("agent:abort", (_event, id: unknown) => {
  sessions.abort(id);
});
ipcMain.handle("agent:command", (_event, value: unknown) =>
  sessions.command(value),
);
ipcMain.handle("agent:respond", (_event, value: unknown) => {
  sessions.respond(value);
});

// Workspace picking uses the native dialog; Explorer and Git stay in packages.
ipcMain.handle("workspace:pick", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open workspace",
    properties: ["openDirectory"],
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle("workspace:read-directory", (_event, value: unknown) => {
  const input = asRecord(value);
  return readDirectory(input?.cwd, input?.path);
});

ipcMain.handle(
  "workspace:git-status",
  (_event, cwd: unknown): Promise<GitStatus> => gitStatus(cwd),
);

ipcMain.handle("workspace:git-stage", (_event, value: unknown) => {
  const input = asRecord(value);
  return gitStage(input?.cwd, input?.path);
});

ipcMain.handle("workspace:git-unstage", (_event, value: unknown) => {
  const input = asRecord(value);
  return gitUnstage(input?.cwd, input?.path);
});

ipcMain.handle("workspace:git-commit", (_event, value: unknown) => {
  const input = asRecord(value);
  return gitCommit(input?.cwd, input?.message);
});

app.on("before-quit", () => {
  isQuitting = true;
  // Agent sessions run in-process, so shutdown only needs to dispose them.
  sessions.stopAll();
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
