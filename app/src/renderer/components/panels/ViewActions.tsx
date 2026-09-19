import { ICON_BUTTON_CLASS } from "./panel-classes";

/** Inputs for the workbench collapse/expand actions. */
export type ViewActionsProps = {
  onTogglePanel: () => void;
  onTogglePrimarySidebar: () => void;
  panelCollapsed: boolean;
  primarySidebarCollapsed: boolean;
};

// Keep the icon direction consistent with the action's current collapsed state.
const iconClass = (
  collapsed: boolean,
  expandedIcon: string,
  collapsedIcon: string,
) => `codicon ${collapsed ? collapsedIcon : expandedIcon}`;

/** Toolbar for toggling the sidebar and the bottom panel. */
export function ViewActions(props: ViewActionsProps) {
  return (
    <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
      <button
        className={ICON_BUTTON_CLASS}
        type="button"
        dotbot-label={
          props.primarySidebarCollapsed
            ? "Expand Side Bar"
            : "Collapse Side Bar"
        }
        dotbot-expanded={String(!props.primarySidebarCollapsed)}
        onClick={props.onTogglePrimarySidebar}
      >
        <span
          className={iconClass(
            props.primarySidebarCollapsed,
            "codicon-layout-sidebar-left",
            "codicon-layout-sidebar-left-off",
          )}
          dotbot-hidden="true"
        />
      </button>
      <button
        className={ICON_BUTTON_CLASS}
        type="button"
        dotbot-label={props.panelCollapsed ? "Expand Panel" : "Collapse Panel"}
        dotbot-expanded={String(!props.panelCollapsed)}
        onClick={props.onTogglePanel}
      >
        <span
          className={iconClass(
            props.panelCollapsed,
            "codicon-layout-panel",
            "codicon-layout-panel-off",
          )}
          dotbot-hidden="true"
        />
      </button>
    </div>
  );
}
