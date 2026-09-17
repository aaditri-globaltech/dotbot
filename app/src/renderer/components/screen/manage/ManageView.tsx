import { useWorkspaceStore } from "../../../stores/workspace-store";
import { PanelHeader } from "../../panels/PanelHeader";
import { GeneralPage } from "./GeneralPage";
import { ManageSidebar } from "./ManageSidebar";
import { ProvidersPage } from "./ProvidersPage";

/** Dedicated settings screen shown while the Manage activity is active. */
export function ManageView() {
  const managePage = useWorkspaceStore((state) => state.managePage);
  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[240px_minmax(0,1fr)] bg-surface">
      <aside className="panel side-panel border-r border-border bg-app">
        <PanelHeader title="MANAGE" />
        <ManageSidebar />
      </aside>
      <div className="min-h-0 min-w-0 overflow-auto px-6 py-5">
        {managePage === "general" ? <GeneralPage /> : <ProvidersPage />}
      </div>
    </div>
  );
}
