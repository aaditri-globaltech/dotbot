import { navigationStore } from "../../../stores/navigation-store";
import { GeneralPage } from "./GeneralPage";
import { ProvidersPage } from "./ProvidersPage";

/** Dedicated settings screen shown while the Manage activity is active. */
export function ManageView() {
  return (
    <div class="panel min-h-0 min-w-0 overflow-auto px-6 py-5">
      {navigationStore.state.managePage === "general" ? (
        <GeneralPage />
      ) : (
        <ProvidersPage />
      )}
    </div>
  );
}
