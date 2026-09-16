import { create } from "zustand";
import type { ActivityView } from "../components/layout/ActivityBar";

// The primary sidebar hosts the currently selected Activity Bar view.
const OPENED_WORKSPACES_KEY = "aria.openedWorkspaces";

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

type WorkspaceStore = {
  activityView: ActivityView;
  workspaces: string[];
  selectedWorkspace?: string;
  setActivityView: (view: ActivityView) => void;
  rememberWorkspace: (cwd: string) => void;
  selectWorkspace: (cwd: string) => void;
  selectInitialWorkspace: (cwd: string) => void;
};

/** Workbench-level workspace selection shared by Explorer, Source Control, and sessions. */
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  activityView: "explorer",
  workspaces: initialWorkspaces,
  selectedWorkspace: initialWorkspaces.at(-1),

  setActivityView: (view) => set({ activityView: view }),

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
