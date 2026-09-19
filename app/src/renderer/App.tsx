/** Application shell: persistent chrome, screen switching, and session bootstrap. */

import { type CSSProperties, useEffect } from "react";
import { MainTopBar, SidebarBrand } from "./components/layout/AppChrome";
import { PrimarySidebar } from "./components/layout/PrimarySidebar";
import { PanelResizer } from "./components/panels/PanelResizer";
import { DashboardView } from "./components/screen/dashboard/DashboardView";
import { ManageSidebar } from "./components/screen/manage/ManageSidebar";
import { ManageView } from "./components/screen/manage/ManageView";
import { WorkbenchView } from "./components/screen/workbench/WorkbenchView";
import { useResizablePanels } from "./hooks/useResizablePanels";
import { useAgentStore } from "./stores/agent-store";
import { useWorkspaceStore } from "./stores/workspace-store";

/** Root renderer component that owns the app-level panel state. */
export default function App() {
  const panels = useResizablePanels();
  const screen = useWorkspaceStore((state) => state.screen);
  const setScreen = useWorkspaceStore((state) => state.setScreen);

  useEffect(() => {
    // Subscribe before listing so a fast session update cannot be missed.
    const store = useAgentStore.getState();
    const unsubscribe = store.subscribe();
    void store.loadSessions().catch((error: unknown) => console.error(error));
    return unsubscribe;
  }, []);

  return (
    <main
      className={`app-shell ${panels.leftCollapsed ? "is-sidebar-collapsed" : ""}`}
      ref={panels.setLayout}
      style={{ "--sidebar-width": `${panels.leftWidth}px` } as CSSProperties}
    >
      <aside id="primary-sidebar" className="sidebar">
        <SidebarBrand />
        {screen === "manage" ? (
          <ManageSidebar onBack={() => setScreen("workbench")} />
        ) : (
          <PrimarySidebar />
        )}
      </aside>

      <PanelResizer
        target="left"
        value={panels.leftWidth}
        label="Resize side bar and view border"
        controls="primary-sidebar view"
        onPointerDown={(event) => panels.startResize("left", event)}
        onKeyDown={(event) => panels.handleKeyDown("left", event)}
      />

      <div className="main-column">
        <MainTopBar
          primarySidebarCollapsed={panels.leftCollapsed}
          panelCollapsed={panels.panelCollapsed}
          onTogglePrimarySidebar={() => panels.toggleCollapsed("left")}
          onTogglePanel={() => panels.toggleCollapsed("bottom")}
        />

        <div className="main-view">
          {screen === "dashboard" ? (
            <DashboardView />
          ) : screen === "manage" ? (
            <ManageView />
          ) : (
            <WorkbenchView panels={panels} />
          )}
        </div>
      </div>
    </main>
  );
}
