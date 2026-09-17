import { create } from "zustand";

const OPENED_WORKSPACES_KEY = "dotbot.openedWorkspaces";

function readOpenedWorkspaces(): string[] {
  try {
    const value: unknown = JSON.parse(
      globalThis.localStorage.getItem(OPENED_WORKSPACES_KEY) ?? "null",
    );
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (workspace): workspace is string =>
                typeof workspace === "string" && workspace.length > 0,
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function writeOpenedWorkspaces(workspaces: string[]) {
  try {
    globalThis.localStorage.setItem(
      OPENED_WORKSPACES_KEY,
      JSON.stringify(workspaces),
    );
  } catch {
    // Storage can be unavailable in restricted renderer contexts.
  }
}

const initialWorkspaces = readOpenedWorkspaces();

/** Screens selectable from the activity bar. */
export type Screen = "dashboard" | "workbench" | "manage";

/** Pages selectable from the manage sidebar. */
export type ManagePage = "general" | "providers";

type WorkspaceStore = {
  screen: Screen;
  managePage: ManagePage;
  workspaces: string[];
  selectedWorkspace?: string;
  setScreen: (screen: Screen) => void;
  setManagePage: (page: ManagePage) => void;
  rememberWorkspace: (cwd: string) => void;
  selectWorkspace: (cwd: string) => void;
  selectInitialWorkspace: (cwd: string) => void;
};

/** Workbench-level workspace selection shared by Explorer, Source Control, and sessions. */
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  screen: "dashboard",
  managePage: "general",
  workspaces: initialWorkspaces,
  selectedWorkspace: initialWorkspaces.at(-1),

  setScreen: (screen) => set({ screen }),

  setManagePage: (page) => set({ managePage: page }),

  rememberWorkspace: (cwd) => {
    if (!cwd || get().workspaces.includes(cwd)) return;
    const next = [...get().workspaces, cwd];
    writeOpenedWorkspaces(next);
    set({ workspaces: next });
  },

  selectWorkspace: (cwd) => {
    if (!cwd) return;
    get().rememberWorkspace(cwd);
    set({ selectedWorkspace: cwd });
  },

  selectInitialWorkspace: (cwd) => {
    if (!get().selectedWorkspace) get().selectWorkspace(cwd);
  },
}));
