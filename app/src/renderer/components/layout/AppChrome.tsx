/** Window chrome: the sidebar brand row and the main title strip. */

import { useEffect, useState } from "react";
import { api } from "../../api";
import { ViewActions, type ViewActionsProps } from "../panels/ViewActions";

const WINDOW_BUTTON_CLASS =
  "grid h-full w-8 cursor-pointer place-items-center border-0 bg-transparent " +
  "text-dim hover:bg-control hover:text-primary [-webkit-app-region:no-drag]";

/** Brand row pinned at the top of the sidebar, doubling as a drag handle. */
export function SidebarBrand() {
  return (
    <div className="app-drag flex min-h-[34px] shrink-0 items-center gap-2 px-3.5">
      <span
        className="codicon codicon-hubot text-[15px] text-accent"
        dotbot-hidden="true"
      />
      <span className="text-[13px] font-medium text-secondary">Dotbot</span>
    </div>
  );
}

/** Title strip above the view: layout actions and window controls. */
export function MainTopBar(props: ViewActionsProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    // The main process owns the real window state; keep the icon synchronized.
    return api.window.onMaximizedChange(setMaximized);
  }, []);

  return (
    <div className="app-drag flex items-center gap-1 pr-0 pl-3">
      <ViewActions {...props} />
      <div className="ml-2 flex self-stretch">
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
