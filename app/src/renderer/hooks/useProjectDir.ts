/** The project the sidebar, composer, and file tree all point at. */

import { useWorkspaceStore } from "../stores/workspace-store";

/** Current project directory: the explicit selection. */
export function useProjectDir(): string | undefined {
  return useWorkspaceStore((state) => state.selectedProject);
}
