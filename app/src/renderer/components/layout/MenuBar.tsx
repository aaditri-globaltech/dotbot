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
    <header className="menu-bar">
      <span className="codicon codicon-code menu-logo" dotbot-hidden="true" />
      <nav dotbot-label="Menu Bar">
        <ul className="menu-items">
          {menuItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li dotbot-hidden="true">
            <span className="codicon codicon-ellipsis" />
          </li>
        </ul>
      </nav>
      <ViewActions {...props} />
      <div className="window-controls">
        <button
          className="window-control"
          type="button"
          dotbot-label="Minimize window"
          onClick={() => api.window.minimize()}
        >
          <span
            className="codicon codicon-chrome-minimize"
            dotbot-hidden="true"
          />
        </button>
        <button
          className="window-control"
          type="button"
          dotbot-label={maximized ? "Restore window" : "Maximize window"}
          onClick={() => api.window.toggleMaximize()}
        >
          <span
            className={`codicon ${maximized ? "codicon-chrome-restore" : "codicon-chrome-maximize"}`}
            dotbot-hidden="true"
          />
        </button>
        <button
          className="window-control window-control-close"
          type="button"
          dotbot-label="Close window"
          onClick={() => api.window.close()}
        >
          <span className="codicon codicon-chrome-close" dotbot-hidden="true" />
        </button>
      </div>
    </header>
  );
}
