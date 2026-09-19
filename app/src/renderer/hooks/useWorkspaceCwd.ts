/** The project the sidebar, composer, and file tree all point at. */

import { useAgentStore } from "../stores/agent-store";
import { useWorkspaceStore } from "../stores/workspace-store";

/**
 * Current workspace: the explicit selection first, then the remembered list,
 * then any session's directory. Screens must agree on this, because the
 * sidebar, composer, and file tree all describe the same project.
 */
export function useWorkspaceCwd(): string | undefined {
  const selectedWorkspace = useWorkspaceStore(
    (state) => state.selectedWorkspace,
  );
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const sessions = useAgentStore((state) => state.sessions);

  return selectedWorkspace ?? workspaces.at(-1) ?? sessions[0]?.cwd;
}
