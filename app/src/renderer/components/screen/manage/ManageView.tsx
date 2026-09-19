import { useWorkspaceStore } from "../../../stores/workspace-store";
import { GeneralPage } from "./GeneralPage";
import { ProvidersPage } from "./ProvidersPage";

/** Dedicated settings screen shown while the Manage activity is active. */
export function ManageView() {
  const managePage = useWorkspaceStore((state) => state.managePage);
  return (
    <div className="panel min-h-0 min-w-0 overflow-auto px-6 py-5">
      {managePage === "general" ? <GeneralPage /> : <ProvidersPage />}
    </div>
  );
}
