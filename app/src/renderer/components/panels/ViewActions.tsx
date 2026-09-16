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
        aria-label={
          props.primarySidebarCollapsed
            ? "Expand Primary Side Bar"
            : "Collapse Primary Side Bar"
        }
        aria-pressed={!props.primarySidebarCollapsed}
        onClick={props.onTogglePrimarySidebar}
      >
        <span
          className={iconClass(
            props.primarySidebarCollapsed,
            "codicon-layout-sidebar-left",
            "codicon-layout-sidebar-left-off",
          )}
          aria-hidden="true"
        />
      </button>
      <button
        className="layout-action"
        type="button"
        aria-label={props.panelCollapsed ? "Expand Panel" : "Collapse Panel"}
        aria-pressed={!props.panelCollapsed}
        onClick={props.onTogglePanel}
      >
        <span
          className={iconClass(
            props.panelCollapsed,
            "codicon-layout-panel",
            "codicon-layout-panel-off",
          )}
          aria-hidden="true"
        />
      </button>
      <button
        className="layout-action"
        type="button"
        aria-label={
          props.secondarySidebarCollapsed
            ? "Expand Secondary Side Bar"
            : "Collapse Secondary Side Bar"
        }
        aria-pressed={!props.secondarySidebarCollapsed}
        onClick={props.onToggleSecondarySidebar}
      >
        <span
          className={iconClass(
            props.secondarySidebarCollapsed,
            "codicon-layout-sidebar-right",
            "codicon-layout-sidebar-right-off",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
