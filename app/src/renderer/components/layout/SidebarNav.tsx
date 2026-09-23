/** Navigation rows for the primary sidebar. */

import { Show } from "solid-js";
import { navigationStore } from "../../stores/navigation-store";
import {
  CHROME_BUTTON_CLASS,
  NAV_ROW_CLASS,
  NAV_ROW_IDLE_CLASS,
  NAV_ROW_SELECTED_CLASS,
} from "../panels/panel-classes";

/** Render the screen rows plus the new-session action, or its icon rail. */
export function SidebarNav(props: {
  onNewSession: () => void;
  collapsed: boolean;
}) {
  const screen = () => navigationStore.state.screen;
  const dashboardSelected = () => screen() === "dashboard";

  return (
    <Show
      when={props.collapsed}
      fallback={
        <nav class="flex flex-col gap-0.5 p-2" label="Screens">
          <button
            class={`${NAV_ROW_CLASS} ${NAV_ROW_IDLE_CLASS}`}
            type="button"
            label="New session"
            onClick={props.onNewSession}
          >
            <span class="codicon codicon-add text-[15px]" decorative="true" />
            New session
          </button>
          <button
            class={`${NAV_ROW_CLASS} ${
              dashboardSelected() ? NAV_ROW_SELECTED_CLASS : NAV_ROW_IDLE_CLASS
            }`}
            type="button"
            label="Dashboard"
            is-selected={String(dashboardSelected())}
            onClick={() => navigationStore.setScreen("dashboard")}
          >
            <span class="codicon codicon-home text-[15px]" decorative="true" />
            Dashboard
          </button>
        </nav>
      }
    >
      <nav class="flex flex-col items-center gap-1 p-2" label="Screens">
        <button
          class={`size-7 ${CHROME_BUTTON_CLASS}`}
          type="button"
          label="New session"
          title="New session"
          onClick={props.onNewSession}
        >
          <span class="codicon codicon-add text-[15px]" decorative="true" />
        </button>
        <button
          class={`size-7 ${CHROME_BUTTON_CLASS} ${
            dashboardSelected() ? "bg-card text-primary" : ""
          }`}
          type="button"
          label="Dashboard"
          title="Dashboard"
          is-selected={String(dashboardSelected())}
          onClick={() => navigationStore.setScreen("dashboard")}
        >
          <span class="codicon codicon-home text-[15px]" decorative="true" />
        </button>
      </nav>
    </Show>
  );
}
