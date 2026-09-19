import {
  type ManagePage,
  useWorkspaceStore,
} from "../../../stores/workspace-store";
import {
  NAV_ROW_CLASS,
  NAV_ROW_IDLE_CLASS,
  NAV_ROW_SELECTED_CLASS,
} from "../../panels/panel-classes";

const manageItems: { id: ManagePage; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "codicon-settings-gear" },
  { id: "providers", label: "Providers", icon: "codicon-server" },
];

/** Navigation list for the manage screen, prefixed by the way back. */
export function ManageSidebar(props: { onBack: () => void }) {
  const managePage = useWorkspaceStore((state) => state.managePage);
  const setManagePage = useWorkspaceStore((state) => state.setManagePage);
  return (
    <nav className="flex flex-col gap-0.5 p-2" dotbot-label="Manage">
      <button
        type="button"
        className={`${NAV_ROW_CLASS} mb-1 ${NAV_ROW_IDLE_CLASS}`}
        dotbot-label="Back to tasks"
        onClick={props.onBack}
      >
        <span
          className="codicon codicon-arrow-left text-[15px]"
          dotbot-hidden="true"
        />
        Back
      </button>
      {manageItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${NAV_ROW_CLASS} ${
            managePage === item.id ? NAV_ROW_SELECTED_CLASS : NAV_ROW_IDLE_CLASS
          }`}
          dotbot-selected={String(managePage === item.id)}
          onClick={() => setManagePage(item.id)}
        >
          <span
            className={`codicon ${item.icon} text-[15px]`}
            dotbot-hidden="true"
          />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
