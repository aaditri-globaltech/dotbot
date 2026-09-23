/** Primary sidebar: navigation, the workspace section, and the model row. */

import { Show } from "solid-js";
import { projectDir } from "../../hooks/project-dir";
import { navigationStore } from "../../stores/navigation-store";
import { sessionStore } from "../../stores/session-store";
import { workspaceStore } from "../../stores/workspace-store";
import { FileTreePanel } from "../panels/FileTreePanel";
import {
  CHROME_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
} from "../panels/panel-classes";
import { modelKey } from "../panels/session-state";
import { WorkspaceSidebar } from "../panels/WorkspaceSidebar";
import { SidebarNav } from "./SidebarNav";

/** Render the always-present sidebar shown on every screen except Manage. */
export function PrimarySidebar(props: { collapsed: boolean }) {
  const state = () => {
    const selectedId = sessionStore.state.selectedId;
    return selectedId ? sessionStore.state.states[selectedId] : undefined;
  };
  const modelName = () => {
    const clientState = state();
    if (!clientState) return undefined;
    return clientState.models.find(
      (model) => modelKey(model) === clientState.selectedModel,
    )?.name;
  };

  const newSession = () => {
    void sessionStore.startNewSession(projectDir());
  };

  const browseFiles = (dir: string) => {
    workspaceStore.selectProject(dir);
    navigationStore.setSidebarMode("files");
  };

  // Opening a session must leave whichever screen the sidebar is shown on.
  const showSession = (id: string) => {
    navigationStore.setScreen("workbench");
    sessionStore.openSession(id);
  };

  return (
    <Show
      when={!props.collapsed}
      fallback={
        <div class="flex h-full min-h-0 w-full flex-col">
          <SidebarNav onNewSession={newSession} collapsed />
          <div class="min-h-0 flex-1" />
          <div class="flex min-h-[34px] shrink-0 items-center justify-center border-t border-border">
            <button
              class={`size-7 ${CHROME_BUTTON_CLASS}`}
              type="button"
              label="Manage settings"
              title="Manage settings"
              onClick={() => navigationStore.setScreen("manage")}
            >
              <span class="codicon codicon-settings-gear" decorative="true" />
            </button>
          </div>
        </div>
      }
    >
      <div class="flex h-full min-h-0 w-full flex-col">
        <Show
          when={navigationStore.state.sidebarMode === "files"}
          fallback={
            <>
              <SidebarNav onNewSession={newSession} collapsed={false} />
              <WorkspaceSidebar
                sessions={sessionStore.state.sessions}
                openTabIds={sessionStore.state.tabs}
                projects={workspaceStore.state.projects}
                onOpen={showSession}
                onBrowseFiles={browseFiles}
                selectedSessionId={sessionStore.state.selectedId}
                projectDir={projectDir()}
              />
            </>
          }
        >
          <button
            class="mx-1.5 mt-2 flex min-h-[30px] cursor-pointer items-center gap-2 rounded-md border-0 px-2 text-left text-[13px] text-secondary hover:bg-surface-hover focus-visible:bg-surface-hover"
            type="button"
            label="Back to sessions"
            onClick={() => navigationStore.setSidebarMode("sessions")}
          >
            <span
              class="codicon codicon-arrow-left shrink-0 text-[15px]"
              decorative="true"
            />
            Back to sessions
          </button>
          <FileTreePanel
            projectDir={projectDir()}
            onPickProject={() => void sessionStore.pickProject()}
          />
        </Show>

        <div class="flex min-h-[34px] shrink-0 items-center gap-2 border-t border-border px-2.5">
          <span class="min-w-0 flex-1 truncate text-[11px] text-muted">
            {modelName() ?? "Dotbot"}
          </span>
          <button
            class={ICON_BUTTON_CLASS}
            type="button"
            label="Manage settings"
            title="Manage settings"
            onClick={() => navigationStore.setScreen("manage")}
          >
            <span class="codicon codicon-settings-gear" decorative="true" />
          </button>
        </div>
      </div>
    </Show>
  );
}
