/** Primary sidebar: navigation, the workspace section, and the model row. */

import { useProjectDir } from "../../hooks/useProjectDir";
import { useAgentStore } from "../../stores/agent-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { modelKey } from "../panels/agent-session-state";
import { FileTreePanel } from "../panels/FileTreePanel";
import {
  CHROME_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
} from "../panels/panel-classes";
import { WorkspaceSidebar } from "../panels/WorkspaceSidebar";
import { SidebarNav } from "./SidebarNav";

/** Render the always-present sidebar shown on every screen except Manage. */
export function PrimarySidebar(props: { collapsed: boolean }) {
  const sessions = useAgentStore((state) => state.sessions);
  const tabs = useAgentStore((state) => state.tabs);
  const selectedId = useAgentStore((state) => state.selectedId);
  const states = useAgentStore((state) => state.states);
  const openSession = useAgentStore((state) => state.openSession);
  const startNewTask = useAgentStore((state) => state.startNewTask);
  const pickProject = useAgentStore((state) => state.pickProject);
  const projects = useWorkspaceStore((state) => state.projects);
  const sidebarMode = useWorkspaceStore((state) => state.sidebarMode);
  const setSidebarMode = useWorkspaceStore((state) => state.setSidebarMode);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const setScreen = useWorkspaceStore((state) => state.setScreen);
  const projectDir = useProjectDir();
  const state = selectedId ? states[selectedId] : undefined;
  const modelName = state?.models.find(
    (model) => modelKey(model) === state.selectedModel,
  )?.name;

  const newSession = () => {
    void startNewTask(projectDir);
  };

  const browseFiles = (cwd: string) => {
    selectProject(cwd);
    setSidebarMode("files");
  };

  // Opening a task must leave whichever screen the sidebar is shown on.
  const openTask = (id: string) => {
    setScreen("workbench");
    openSession(id);
  };

  if (props.collapsed) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <SidebarNav onNewSession={newSession} collapsed />
        <div className="min-h-0 flex-1" />
        <div className="flex min-h-[34px] shrink-0 items-center justify-center border-t border-border">
          <button
            className={`size-7 ${CHROME_BUTTON_CLASS}`}
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
            projectDir={projectDir}
            onPickProject={() => void pickProject()}
          />
        </>
      ) : (
        <>
          <SidebarNav onNewSession={newSession} collapsed={false} />
          <WorkspaceSidebar
            sessions={sessions}
            openTabIds={tabs}
            projects={projects}
            onOpen={openTask}
            onBrowseFiles={browseFiles}
            selectedSessionId={selectedId}
            projectDir={projectDir}
          />
        </>
      )}

      <div className="flex min-h-[34px] shrink-0 items-center gap-2 border-t border-border px-2.5">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
          {modelName ?? "Dotbot"}
        </span>
        <button
          className={ICON_BUTTON_CLASS}
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
