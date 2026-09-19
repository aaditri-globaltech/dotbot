import { create } from "zustand";

const OPENED_WORKSPACES_KEY = "dotbot.openedWorkspaces";

function readOpenedProjects(): string[] {
  try {
    const value: unknown = JSON.parse(
      globalThis.localStorage.getItem(OPENED_WORKSPACES_KEY) ?? "null",
    );
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (projectDir): projectDir is string =>
                typeof projectDir === "string" && projectDir.length > 0,
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function writeOpenedProjects(projects: string[]) {
  try {
    globalThis.localStorage.setItem(
      OPENED_WORKSPACES_KEY,
      JSON.stringify(projects),
    );
  } catch {
    // Storage can be unavailable in restricted renderer contexts.
  }
}

const initialProjects = readOpenedProjects();

/** Screens selectable from the primary sidebar. */
export type Screen = "dashboard" | "workbench" | "manage";

/** What the sidebar shows below its navigation rows. */
type SidebarMode = "tasks" | "files";

/** Pages selectable from the manage sidebar. */
export type ManagePage = "general" | "providers";

type WorkspaceStore = {
  screen: Screen;
  sidebarMode: SidebarMode;
  managePage: ManagePage;
  /** Project directories the workspace holds, in open order. */
  projects: string[];
  selectedProject?: string;
  setScreen: (screen: Screen) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setManagePage: (page: ManagePage) => void;
  rememberProject: (projectDir: string) => void;
  selectProject: (projectDir: string) => void;
};

/** Workspace state shared by the sidebar, dashboard, and workbench. */
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  screen: "dashboard",
  sidebarMode: "tasks",
  managePage: "general",
  projects: initialProjects,
  selectedProject: initialProjects.at(-1),

  setScreen: (screen) => set({ screen }),

  setSidebarMode: (mode) => set({ sidebarMode: mode }),

  setManagePage: (page) => set({ managePage: page }),

  rememberProject: (projectDir) => {
    if (!projectDir || get().projects.includes(projectDir)) return;
    const next = [...get().projects, projectDir];
    writeOpenedProjects(next);
    set({ projects: next });
  },

  selectProject: (projectDir) => {
    if (!projectDir) return;
    get().rememberProject(projectDir);
    set({ selectedProject: projectDir });
  },
}));
