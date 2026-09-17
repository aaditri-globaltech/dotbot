import { PanelHeader } from "../../panels/PanelHeader";

/** Placeholder home screen shown by default. */
export function DashboardView() {
  return (
    <div className="dashboard-layout">
      <PanelHeader title="DASHBOARD" />
      <div className="screen-content">
        <p className="screen-empty">Dashboard widgets will appear here.</p>
      </div>
    </div>
  );
}
