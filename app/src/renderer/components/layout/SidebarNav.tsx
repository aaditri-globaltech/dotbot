/** Navigation rows for the primary sidebar. */

import { useWorkspaceStore } from "../../stores/workspace-store";
import {
  NAV_ROW_CLASS,
  NAV_ROW_IDLE_CLASS,
  NAV_ROW_SELECTED_CLASS,
} from "../panels/panel-classes";

/** Render the screen rows plus the new-task action. */
export function SidebarNav(props: { onNewSession: () => void }) {
  const screen = useWorkspaceStore((state) => state.screen);
  const setScreen = useWorkspaceStore((state) => state.setScreen);
  const onDashboard = screen === "dashboard";

  return (
    <nav className="flex flex-col gap-0.5 p-2" dotbot-label="Screens">
      <button
        className={`${NAV_ROW_CLASS} ${NAV_ROW_IDLE_CLASS}`}
        type="button"
        dotbot-label="New task"
        onClick={props.onNewSession}
      >
        <span
          className="codicon codicon-add text-[15px]"
          dotbot-hidden="true"
        />
        New task
      </button>
      <button
        className={`${NAV_ROW_CLASS} ${
          onDashboard ? NAV_ROW_SELECTED_CLASS : NAV_ROW_IDLE_CLASS
        }`}
        type="button"
        dotbot-label="Dashboard"
        dotbot-selected={String(onDashboard)}
        onClick={() => setScreen("dashboard")}
      >
        <span
          className="codicon codicon-home text-[15px]"
          dotbot-hidden="true"
        />
        Dashboard
      </button>
    </nav>
  );
}
