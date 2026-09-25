import { createStore } from "solid-js/store";

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

type WorkspaceState = {
  /** Project directories the workspace holds, in open order. */
  projects: string[];
  selectedProject?: string;
};

/** Workspace state: the opened projects and the selected one. */
export function createWorkspaceStore() {
  const projects = readOpenedProjects();
  const [state, setState] = createStore<WorkspaceState>({
    projects,
    selectedProject: projects.at(-1),
  });

  const rememberProject = (projectDir: string) => {
    if (!projectDir || state.projects.includes(projectDir)) return;
    const next = [...state.projects, projectDir];
    writeOpenedProjects(next);
    setState("projects", next);
  };

  return {
    state,
    rememberProject,

    selectProject: (projectDir: string) => {
      if (!projectDir) return;
      rememberProject(projectDir);
      setState("selectedProject", projectDir);
    },
  };
}

/** Shared workspace store for the running app. */
export const workspaceStore = createWorkspaceStore();
