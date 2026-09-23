/** Application shell: persistent chrome, screen switching, and session bootstrap. */

import { Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { MainTopBar, SidebarBrand } from "./components/layout/AppChrome";
import { PrimarySidebar } from "./components/layout/PrimarySidebar";
import { SessionTabs } from "./components/layout/SessionTabs";
import { PanelResizer } from "./components/panels/PanelResizer";
import { DashboardView } from "./components/screen/dashboard/DashboardView";
import { ManageSidebar } from "./components/screen/manage/ManageSidebar";
import { ManageView } from "./components/screen/manage/ManageView";
import { WorkbenchView } from "./components/screen/workbench/WorkbenchView";
import { createResizablePanels } from "./hooks/resizable-panels";
import { navigationStore } from "./stores/navigation-store";
import { sessionStore } from "./stores/session-store";
import { trustStore } from "./stores/trust-store";

/** Root renderer component that owns the app-level panel state. */
export default function App() {
  const panels = createResizablePanels();

  onMount(() => {
    // Subscribe before listing so a fast session update cannot be missed.
    const unsubscribe = sessionStore.subscribe();
    const unsubscribeTrust = trustStore.subscribe();
    void sessionStore
      .loadSessions()
      .catch((error: unknown) => console.error(error));
    onCleanup(() => {
      unsubscribeTrust();
      unsubscribe();
    });
  });

  return (
    <main
      class={`app-shell ${panels.leftCollapsed() ? "is-sidebar-collapsed" : ""}`}
      ref={panels.setLayout}
      style={{ "--sidebar-width": `${panels.leftWidth()}px` }}
    >
      <aside id="primary-sidebar" class="sidebar">
        <SidebarBrand collapsed={panels.leftCollapsed()} />
        <Show
          when={navigationStore.state.screen === "manage"}
          fallback={<PrimarySidebar collapsed={panels.leftCollapsed()} />}
        >
          <ManageSidebar
            collapsed={panels.leftCollapsed()}
            onBack={() => navigationStore.setScreen("workbench")}
          />
        </Show>
      </aside>

      <PanelResizer
        target="left"
        value={panels.leftWidth()}
        label="Resize side bar and view border"
        controls="primary-sidebar view"
        onPointerDown={(event) => panels.startResize("left", event)}
        onKeyDown={(event) => panels.handleKeyDown("left", event)}
      />

      <div class="main-column">
        <MainTopBar
          primarySidebarCollapsed={panels.leftCollapsed()}
          panelCollapsed={panels.panelCollapsed()}
          onTogglePrimarySidebar={() => panels.toggleCollapsed("left")}
          onTogglePanel={() => panels.toggleCollapsed("bottom")}
        >
          <Show when={navigationStore.state.screen === "workbench"}>
            <SessionTabs />
          </Show>
        </MainTopBar>

        <div class="main-view">
          <Switch fallback={<WorkbenchView panels={panels} />}>
            <Match when={navigationStore.state.screen === "dashboard"}>
              <DashboardView />
            </Match>
            <Match when={navigationStore.state.screen === "manage"}>
              <ManageView />
            </Match>
          </Switch>
        </div>
      </div>
    </main>
  );
}
