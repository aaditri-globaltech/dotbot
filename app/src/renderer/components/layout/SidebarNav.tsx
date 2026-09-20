/** Navigation rows for the primary sidebar. */

import { useNavigationStore } from "../../stores/navigation-store";
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
  const screen = useNavigationStore((state) => state.screen);
  const setScreen = useNavigationStore((state) => state.setScreen);
  const onDashboard = screen === "dashboard";

  if (props.collapsed) {
    return (
      <nav
        className="flex flex-col items-center gap-1 p-2"
        dotbot-label="Screens"
      >
        <button
          className={`size-7 ${CHROME_BUTTON_CLASS}`}
          type="button"
          dotbot-label="New session"
          title="New session"
          onClick={props.onNewSession}
        >
          <span
            className="codicon codicon-add text-[15px]"
            dotbot-hidden="true"
          />
        </button>
        <button
          className={`size-7 ${CHROME_BUTTON_CLASS} ${
            onDashboard ? "bg-card text-primary" : ""
          }`}
          type="button"
          dotbot-label="Dashboard"
          title="Dashboard"
          dotbot-selected={String(onDashboard)}
          onClick={() => setScreen("dashboard")}
        >
          <span
            className="codicon codicon-home text-[15px]"
            dotbot-hidden="true"
          />
        </button>
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 p-2" dotbot-label="Screens">
      <button
        className={`${NAV_ROW_CLASS} ${NAV_ROW_IDLE_CLASS}`}
        type="button"
        dotbot-label="New session"
        onClick={props.onNewSession}
      >
        <span
          className="codicon codicon-add text-[15px]"
          dotbot-hidden="true"
        />
        New session
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
