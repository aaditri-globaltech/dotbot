/** Coordinates session data, renderer state, and the surrounding workbench panels. */

import type { CSSProperties } from "react";
import { useEffect } from "react";
import { useResizablePanels } from "../../hooks/useResizablePanels";
import { useAgentStore } from "../../stores/agent-store";
import { useWorkspaceStore } from "../../stores/workspace-store";
import { ActivityBar, type ActivityView } from "../layout/ActivityBar";
import { MenuBar } from "../layout/MenuBar";
import { StatusBar } from "../layout/StatusBar";
import { AgentView } from "./AgentView";
import { ExplorerSidebar } from "./ExplorerSidebar";
import { PanelHeader } from "./PanelHeader";
import { PanelResizer } from "./PanelResizer";
import { SessionSidebar } from "./SessionSidebar";
import { SourceControlSidebar } from "./SourceControlSidebar";

const activityLabels: Record<ActivityView, string> = {
  explorer: "EXPLORER",
  search: "SEARCH",
  "source-control": "SOURCE CONTROL",
  "run-and-debug": "RUN AND DEBUG",
  extensions: "EXTENSIONS",
  accounts: "ACCOUNTS",
  manage: "MANAGE",
};

/** Compose the desktop workbench and coordinate its feature adapters. */
export function PanelLayout() {
  const panels = useResizablePanels();
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
  const activityView = useWorkspaceStore((state) => state.activityView);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const selectedWorkspace = useWorkspaceStore(
    (state) => state.selectedWorkspace,
  );
  const setActivityView = useWorkspaceStore((state) => state.setActivityView);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);

  useEffect(() => {
    // Subscribe before listing so a fast session update cannot be missed.
    const store = useAgentStore.getState();
    const unsubscribe = store.subscribe();
    void store.loadSessions().catch((error: unknown) => console.error(error));
    return unsubscribe;
  }, []);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const tabSessions = tabs.flatMap((id) => {
    const session = sessionById.get(id);
    return session ? [session] : [];
  });
  const selectedSession = selectedId ? sessionById.get(selectedId) : undefined;
  const selectedState = selectedId ? states[selectedId] : undefined;
  // Explorer and Source Control have their own workspace selection, independent of the open session.
  const workspaceCwd = selectedWorkspace ?? workspaces[0] ?? sessions[0]?.cwd;
  const waitingSessions = sessions.filter(
    (session) => session.status === "waiting",
  );

  const selectActivityView = (view: ActivityView) => {
    if (view === activityView && !panels.leftCollapsed) {
      panels.toggleCollapsed("left");
      return;
    }

    setActivityView(view);
    if (panels.leftCollapsed) panels.toggleCollapsed("left");
  };

  return (
    <main className="app-shell">
      <MenuBar
        primarySidebarCollapsed={panels.leftCollapsed}
        secondarySidebarCollapsed={panels.rightCollapsed}
        panelCollapsed={panels.panelCollapsed}
        onTogglePrimarySidebar={() => panels.toggleCollapsed("left")}
        onToggleSecondarySidebar={() => panels.toggleCollapsed("right")}
        onTogglePanel={() => panels.toggleCollapsed("bottom")}
      />

      <div className="workbench">
        <ActivityBar selected={activityView} onSelect={selectActivityView} />

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
            className={`panel side-panel left-panel ${panels.leftCollapsed ? "is-collapsed" : ""}`}
          >
            <PanelHeader title={activityLabels[activityView]} />
            {activityView === "explorer" && (
              <ExplorerSidebar
                cwd={workspaceCwd}
                workspaces={workspaces}
                onSelectWorkspace={selectWorkspace}
                onPickWorkspace={() => void pickWorkspaceAndCreateSession()}
              />
            )}
            {activityView === "source-control" && (
              <SourceControlSidebar cwd={workspaceCwd} />
            )}
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
              className={`panel bottom-panel ${panels.panelCollapsed ? "is-collapsed" : ""}`}
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
            className={`panel side-panel right-panel session-panel ${panels.rightCollapsed ? "is-collapsed" : ""}`}
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
      </div>

      <StatusBar
        waitingSessions={waitingSessions}
        onSelectSession={openSession}
      />
    </main>
  );
}
