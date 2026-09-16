/** Inputs for the workbench collapse/expand actions. */
export type ViewActionsProps = {
  onTogglePanel: () => void;
  onTogglePrimarySidebar: () => void;
  onToggleSecondarySidebar: () => void;
  panelCollapsed: boolean;
  primarySidebarCollapsed: boolean;
  secondarySidebarCollapsed: boolean;
};

// Keep the icon direction consistent with the action's current collapsed state.
const iconClass = (
  collapsed: boolean,
  expandedIcon: string,
  collapsedIcon: string,
) => `codicon ${collapsed ? collapsedIcon : expandedIcon}`;

/** Toolbar for toggling the three resizable workbench regions. */
export function ViewActions(props: ViewActionsProps) {
  return (
    <div className="layout-actions">
      <button
        className="layout-action"
        type="button"
        dotbot-label={
          props.primarySidebarCollapsed
            ? "Expand Primary Side Bar"
            : "Collapse Primary Side Bar"
        }
        dotbot-pressed={!props.primarySidebarCollapsed}
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
        className="layout-action"
        type="button"
        dotbot-label={props.panelCollapsed ? "Expand Panel" : "Collapse Panel"}
        dotbot-pressed={!props.panelCollapsed}
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
      <button
        className="layout-action"
        type="button"
        dotbot-label={
          props.secondarySidebarCollapsed
            ? "Expand Secondary Side Bar"
            : "Collapse Secondary Side Bar"
        }
        dotbot-pressed={!props.secondarySidebarCollapsed}
        onClick={props.onToggleSecondarySidebar}
      >
        <span
          className={iconClass(
            props.secondarySidebarCollapsed,
            "codicon-layout-sidebar-right",
            "codicon-layout-sidebar-right-off",
          )}
          dotbot-hidden="true"
        />
      </button>
    </div>
  );
}
