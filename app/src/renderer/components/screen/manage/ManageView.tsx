import { useWorkspaceStore } from "../../../stores/workspace-store";
import { PanelHeader } from "../../panels/PanelHeader";
import { GeneralPage } from "./GeneralPage";
import { ManageSidebar } from "./ManageSidebar";
import { ProvidersPage } from "./ProvidersPage";

/** Dedicated settings screen shown while the Manage activity is active. */
export function ManageView() {
  const managePage = useWorkspaceStore((state) => state.managePage);
  return (
    <div className="manage-layout">
      <aside className="panel side-panel manage-sidebar">
        <PanelHeader title="MANAGE" />
        <ManageSidebar />
      </aside>
      <div className="screen-content">
        {managePage === "general" ? <GeneralPage /> : <ProvidersPage />}
      </div>
    </div>
  );
}
