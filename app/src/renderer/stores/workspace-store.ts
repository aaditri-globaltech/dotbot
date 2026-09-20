import { create } from "zustand";

const OPENED_PROJECTS_KEY = "dotbot.openedProjects";
// Key written before the vocabulary pass; read it so upgrades keep their projects.
const LEGACY_OPENED_PROJECTS_KEY = "dotbot.openedWorkspaces";

function readOpenedProjects(): string[] {
  try {
    const stored =
      globalThis.localStorage.getItem(OPENED_PROJECTS_KEY) ??
      globalThis.localStorage.getItem(LEGACY_OPENED_PROJECTS_KEY);
    const value: unknown = JSON.parse(stored ?? "null");
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
      OPENED_PROJECTS_KEY,
      JSON.stringify(projects),
    );
  } catch {
    // Storage can be unavailable in restricted renderer contexts.
  }
}

const initialProjects = readOpenedProjects();

type WorkspaceStore = {
  /** Project directories the workspace holds, in open order. */
  projects: string[];
  selectedProject?: string;
  rememberProject: (projectDir: string) => void;
  selectProject: (projectDir: string) => void;
};

/** Workspace state: the opened projects and the selected one. */
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  projects: initialProjects,
  selectedProject: initialProjects.at(-1),

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
