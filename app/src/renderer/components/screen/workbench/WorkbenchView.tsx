/** Workbench screen: primary sidebar, agent viewport, bottom panel, and session sidebar. */

import { type CSSProperties, useEffect } from "react";
import { api } from "../../../api";
import type { ResizablePanels } from "../../../hooks/useResizablePanels";
import { useAgentStore } from "../../../stores/agent-store";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { AgentView } from "../../panels/AgentView";
import { ExplorerSidebar } from "../../panels/ExplorerSidebar";
import { PanelHeader } from "../../panels/PanelHeader";
import { PanelResizer } from "../../panels/PanelResizer";
import { SessionSidebar } from "../../panels/SessionSidebar";
import { SourceControlSidebar } from "../../panels/SourceControlSidebar";

type WorkbenchViewProps = {
  panels: ResizablePanels;
};

/** Normal workbench layout, shown whenever the workbench screen is active. */
export function WorkbenchView(props: WorkbenchViewProps) {
  const { panels } = props;
  const sessions = useAgentStore((state) => state.sessions);
  const tabs = useAgentStore((state) => state.tabs);
  const selectedId = useAgentStore((state) => state.selectedId);
  const states = useAgentStore((state) => state.states);
  const selectSession = useAgentStore((state) => state.selectSession);
  const openSession = useAgentStore((state) => state.openSession);
  const closeTab = useAgentStore((state) => state.closeTab);
  const createSession = useAgentStore((state) => state.createSession);
  const pickWorkspaceAndCreateSession = useAgentStore(
    (state) => state.pickWorkspaceAndCreateSession,
  );
  const prompt = useAgentStore((state) => state.prompt);
  const abort = useAgentStore((state) => state.abort);
  const command = useAgentStore((state) => state.command);
  const respond = useAgentStore((state) => state.respond);
  const setDraft = useAgentStore((state) => state.setDraft);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const selectedWorkspace = useWorkspaceStore(
    (state) => state.selectedWorkspace,
  );
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const tabSessions = tabs.flatMap((id) => {
    const session = sessionById.get(id);
    return session ? [session] : [];
  });
  const selectedSession = selectedId ? sessionById.get(selectedId) : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;
  // Explorer and Source Control share the workspace selection, independent of the open session.
  const workspaceCwd = selectedWorkspace ?? workspaces[0] ?? sessions[0]?.cwd;

  // Watch only the active workspace; leaving the workbench stops the watch.
  useEffect(() => {
    if (!workspaceCwd) return;
    void api.workspace
      .watch(workspaceCwd)
      .catch((error: unknown) => console.error(error));
    return () => {
      void api.workspace
        .unwatch()
        .catch((error: unknown) => console.error(error));
    };
  }, [workspaceCwd]);

  return (
    <div
      className={`workspace-layout ${panels.leftCollapsed ? "is-primary-sidebar-collapsed" : ""} ${panels.rightCollapsed ? "is-secondary-sidebar-collapsed" : ""}`}
      ref={panels.setLayout}
      style={
        {
          "--left-panel-width": `${panels.leftWidth}px`,
          "--right-panel-width": `${panels.rightWidth}px`,
          "--panel-height": `${panels.panelHeight}px`,
        } as CSSProperties
      }
    >
      <aside
        id="primary-sidebar"
        className={`panel side-panel left-panel border-r border-border bg-app ${panels.leftCollapsed ? "is-collapsed" : ""}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <PanelHeader title="EXPLORER" />
          <ExplorerSidebar
            cwd={workspaceCwd}
            workspaces={workspaces}
            onSelectWorkspace={selectWorkspace}
            onPickWorkspace={() => void pickWorkspaceAndCreateSession()}
          />
        </div>
        <details className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-t border-border">
          <summary className="flex min-h-7 shrink-0 cursor-pointer items-center border-b border-border bg-app px-3 text-[11px] font-medium tracking-[0.04em] text-muted uppercase [&::-webkit-details-marker]:hidden">
            Source Control
          </summary>
          <SourceControlSidebar cwd={workspaceCwd} />
        </details>
      </aside>

      <PanelResizer
        target="left"
        value={panels.leftWidth}
        label="Resize primary side bar and view border"
        controls="primary-sidebar view"
        onPointerDown={(event) => panels.startResize("left", event)}
        onKeyDown={(event) => panels.handleKeyDown("left", event)}
      />

      <div
        className={`view-area ${panels.panelCollapsed ? "is-panel-collapsed" : ""}`}
      >
        <AgentView
          tabs={tabSessions}
          selectedSession={selectedSession}
          state={selectedState}
          onSelectTab={selectSession}
          onCloseTab={closeTab}
          onNewSession={() => void createSession(workspaceCwd ?? "")}
          onDraft={setDraft}
          onPrompt={prompt}
          onAbort={abort}
          onCommand={command}
          onRespond={respond}
        />

        <PanelResizer
          target="bottom"
          value={panels.panelHeight}
          label="Resize panel top border"
          controls="view panel"
          onPointerDown={(event) => panels.startResize("bottom", event)}
          onKeyDown={(event) => panels.handleKeyDown("bottom", event)}
        />

        <section
          id="panel"
          className={`panel bottom-panel border-t border-border bg-app ${panels.panelCollapsed ? "is-collapsed" : ""}`}
        >
          <PanelHeader title="Panel" />
        </section>
      </div>

      <PanelResizer
        target="right"
        value={panels.rightWidth}
        label="Resize view and secondary side bar border"
        controls="view secondary-sidebar"
        onPointerDown={(event) => panels.startResize("right", event)}
        onKeyDown={(event) => panels.handleKeyDown("right", event)}
      />

      <aside
        id="secondary-sidebar"
        className={`panel side-panel right-panel session-panel border-l border-border ${panels.rightCollapsed ? "is-collapsed" : ""}`}
      >
        <SessionSidebar
          sessions={sessions}
          openTabIds={tabs}
          onOpen={openSession}
          onNew={() => void createSession(workspaceCwd ?? "")}
          selectedSessionId={selectedId}
          workspaceCwd={workspaceCwd}
        />
      </aside>
    </div>
  );
}
