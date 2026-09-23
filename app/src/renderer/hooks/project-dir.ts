/** The project the sidebar, composer, and file tree all point at. */

import { workspaceStore } from "../stores/workspace-store";

/** Current project directory: the explicit selection. */
export function projectDir(): string | undefined {
  return workspaceStore.state.selectedProject;
}
