/** Application shell: persistent chrome, screen switching, and session bootstrap. */

import { useEffect } from "react";
import { ActivityBar } from "./components/layout/ActivityBar";
import { MenuBar } from "./components/layout/MenuBar";
import { StatusBar } from "./components/layout/StatusBar";
import { DashboardView } from "./components/screen/dashboard/DashboardView";
import { ManageView } from "./components/screen/manage/ManageView";
import { WorkbenchView } from "./components/screen/workbench/WorkbenchView";
import { useResizablePanels } from "./hooks/useResizablePanels";
import { useAgentStore } from "./stores/agent-store";
import { type Screen, useWorkspaceStore } from "./stores/workspace-store";

/** Root renderer component that owns the app-level panel state. */
export default function App() {
  const panels = useResizablePanels();
  const screen = useWorkspaceStore((state) => state.screen);
  const setScreen = useWorkspaceStore((state) => state.setScreen);
  const sessions = useAgentStore((state) => state.sessions);
  const openSession = useAgentStore((state) => state.openSession);

  useEffect(() => {
    // Subscribe before listing so a fast session update cannot be missed.
    const store = useAgentStore.getState();
    const unsubscribe = store.subscribe();
    void store.loadSessions().catch((error: unknown) => console.error(error));
    return unsubscribe;
  }, []);

  const waitingSessions = sessions.filter(
    (session) => session.status === "waiting",
  );

  const selectScreen = (next: Screen) => {
    if (next === screen) {
      if (next === "workbench" && !panels.leftCollapsed) {
        panels.toggleCollapsed("left");
      }
      return;
    }

    setScreen(next);
    if (next === "workbench" && panels.leftCollapsed) {
      panels.toggleCollapsed("left");
    }
  };

  // Opening a session from the status bar must leave the other screens.
  const showSession = (id: string) => {
    if (screen !== "workbench") setScreen("workbench");
    openSession(id);
  };

  return (
    <main className="grid h-full min-h-[640px] w-full min-w-[1100px] grid-rows-[34px_minmax(0,1fr)_22px] bg-app">
      <MenuBar
        primarySidebarCollapsed={panels.leftCollapsed}
        secondarySidebarCollapsed={panels.rightCollapsed}
        panelCollapsed={panels.panelCollapsed}
        onTogglePrimarySidebar={() => panels.toggleCollapsed("left")}
        onToggleSecondarySidebar={() => panels.toggleCollapsed("right")}
        onTogglePanel={() => panels.toggleCollapsed("bottom")}
      />

      <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] grid-cols-[48px_minmax(0,1fr)]">
        <ActivityBar selected={screen} onSelect={selectScreen} />

        {screen === "dashboard" ? (
          <DashboardView />
        ) : screen === "manage" ? (
          <ManageView />
        ) : (
          <WorkbenchView panels={panels} />
        )}
      </div>

      <StatusBar
        waitingSessions={waitingSessions}
        onSelectSession={showSession}
      />
    </main>
  );
}
