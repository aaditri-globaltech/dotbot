/** Primary sidebar: navigation, the workspace section, and the model row. */

import { useWorkspaceCwd } from "../../hooks/useWorkspaceCwd";
import { useAgentStore } from "../../stores/agent-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { modelKey } from "../panels/agent-session-state";
import { FileTreePanel } from "../panels/FileTreePanel";
import { WorkspaceSidebar } from "../panels/WorkspaceSidebar";
import { SidebarNav } from "./SidebarNav";

/** Render the always-present sidebar shown on every screen except Manage. */
export function PrimarySidebar() {
  const sessions = useAgentStore((state) => state.sessions);
  const tabs = useAgentStore((state) => state.tabs);
  const selectedId = useAgentStore((state) => state.selectedId);
  const states = useAgentStore((state) => state.states);
  const openSession = useAgentStore((state) => state.openSession);
  const createSession = useAgentStore((state) => state.createSession);
  const pickWorkspaceAndCreateSession = useAgentStore(
    (state) => state.pickWorkspaceAndCreateSession,
  );
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const sidebarMode = useWorkspaceStore((state) => state.sidebarMode);
  const setSidebarMode = useWorkspaceStore((state) => state.setSidebarMode);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);
  const setScreen = useWorkspaceStore((state) => state.setScreen);
  const workspaceCwd = useWorkspaceCwd();
  const state = selectedId ? states[selectedId] : undefined;
  const modelName = state?.models.find(
    (model) => modelKey(model) === state.selectedModel,
  )?.name;

  const newSession = () => {
    if (!workspaceCwd) {
      void pickWorkspaceAndCreateSession();
      return;
    }
    void createSession(workspaceCwd);
    setScreen("workbench");
  };

  const browseFiles = (cwd: string) => {
    selectWorkspace(cwd);
    setSidebarMode("files");
  };

  // Opening a task must leave whichever screen the sidebar is shown on.
  const openTask = (id: string) => {
    setScreen("workbench");
    openSession(id);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {sidebarMode === "files" ? (
        <>
          <button
            className="mx-1.5 mt-2 flex min-h-[30px] cursor-pointer items-center gap-2 rounded-md border-0 px-2 text-left text-[13px] text-secondary hover:bg-surface-hover focus-visible:bg-surface-hover"
            type="button"
            dotbot-label="Back to tasks"
            onClick={() => setSidebarMode("tasks")}
          >
            <span
              className="codicon codicon-arrow-left shrink-0 text-[15px]"
              dotbot-hidden="true"
            />
            Back to Tasks
          </button>
          <FileTreePanel
            cwd={workspaceCwd}
            onPickWorkspace={() => void pickWorkspaceAndCreateSession()}
          />
        </>
      ) : (
        <>
          <SidebarNav onNewSession={newSession} />
          <WorkspaceSidebar
            sessions={sessions}
            openTabIds={tabs}
            workspaces={workspaces}
            onOpen={openTask}
            onBrowseFiles={browseFiles}
            selectedSessionId={selectedId}
            workspaceCwd={workspaceCwd}
          />
        </>
      )}

      <div className="flex min-h-[34px] shrink-0 items-center gap-2 border-t border-border px-2.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
          {modelName ?? "Dotbot"}
        </span>
        <button
          className="grid size-5.5 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-dim hover:bg-control hover:text-primary focus-visible:ring-1 focus-visible:ring-focus"
          type="button"
          dotbot-label="Manage settings"
          title="Manage settings"
          onClick={() => setScreen("manage")}
        >
          <span
            className="codicon codicon-settings-gear"
            dotbot-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
