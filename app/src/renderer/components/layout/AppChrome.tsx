/** Window chrome: the sidebar brand row and the main title strip. */

import { type ReactNode, useEffect, useState } from "react";
import { api } from "../../api";
import { ICON_BUTTON_CLASS } from "../panels/panel-classes";
import { ViewActions, type ViewActionsProps } from "../panels/ViewActions";

const WINDOW_BUTTON_CLASS = `${ICON_BUTTON_CLASS} [-webkit-app-region:no-drag]`;

/** Brand row pinned at the top of the sidebar, doubling as a drag handle. */
export function SidebarBrand(props: { collapsed: boolean }) {
  return (
    <div
      className={`app-drag flex min-h-[34px] shrink-0 items-center gap-2 ${
        props.collapsed ? "justify-center px-0" : "px-3.5"
      }`}
    >
      <span
        className="codicon codicon-hubot text-[15px] text-accent"
        dotbot-hidden="true"
      />
      {!props.collapsed && (
        <span className="text-[13px] font-medium text-secondary">Dotbot</span>
      )}
    </div>
  );
}

/** Title strip above the view: session tabs, layout actions, and window controls. */
export function MainTopBar(props: ViewActionsProps & { children?: ReactNode }) {
  const [maximized, setMaximized] = useState(false);
  const { children, ...actions } = props;

  useEffect(() => {
    // The main process owns the real window state; keep the icon synchronized.
    return api.window.onMaximizedChange(setMaximized);
  }, []);

  return (
    <div className="app-drag flex items-center gap-1 pr-0 pl-3">
      {children}
      <ViewActions {...actions} />
      <div className="ml-2 flex items-center gap-1">
        <button
          className={WINDOW_BUTTON_CLASS}
          type="button"
          dotbot-label="Minimize window"
          onClick={() => api.window.minimize()}
        >
          <span
            className="codicon codicon-chrome-minimize text-[13px]"
            dotbot-hidden="true"
          />
        </button>
        <button
          className={WINDOW_BUTTON_CLASS}
          type="button"
          dotbot-label={maximized ? "Restore window" : "Maximize window"}
          onClick={() => api.window.toggleMaximize()}
        >
          <span
            className={`codicon text-[13px] ${maximized ? "codicon-chrome-restore" : "codicon-chrome-maximize"}`}
            dotbot-hidden="true"
          />
        </button>
        <button
          className={`${WINDOW_BUTTON_CLASS} hover:bg-window-close hover:text-primary`}
          type="button"
          dotbot-label="Close window"
          onClick={() => api.window.close()}
        >
          <span
            className="codicon codicon-chrome-close text-[13px]"
            dotbot-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
