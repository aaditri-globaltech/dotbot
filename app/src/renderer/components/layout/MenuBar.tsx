import { useEffect, useState } from "react";
import { api } from "../../api";
import { ViewActions, type ViewActionsProps } from "../panels/ViewActions";

const menuItems = ["File", "Edit", "Selection", "View", "Go", "Run"];

type MenuBarProps = ViewActionsProps;

/** Render the custom menu bar, layout actions, and window controls. */
export function MenuBar(props: MenuBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    // The main process owns the real window state; keep the icon synchronized.
    return api.window.onMaximizedChange(setMaximized);
  }, []);

  return (
    <header className="flex items-center border-b border-border bg-app pl-2.5 [-webkit-app-region:drag]">
      <span
        className="codicon codicon-code text-base text-accent"
        dotbot-hidden="true"
      />
      <nav className="h-full" dotbot-label="Menu Bar">
        <ul className="flex h-full list-none items-center gap-4 text-xs text-muted">
          {menuItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li dotbot-hidden="true">
            <span className="codicon codicon-ellipsis" />
          </li>
        </ul>
      </nav>
      <ViewActions {...props} />
      <div className="ml-2 flex self-stretch [-webkit-app-region:no-drag]">
        <button
          className="grid h-full w-8 cursor-pointer place-items-center border-0 bg-transparent text-dim hover:bg-control hover:text-primary"
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
          className="grid h-full w-8 cursor-pointer place-items-center border-0 bg-transparent text-dim hover:bg-control hover:text-primary"
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
          className="grid h-full w-8 cursor-pointer place-items-center border-0 bg-transparent text-dim hover:bg-window-close hover:text-primary"
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
    </header>
  );
}
