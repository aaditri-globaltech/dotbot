import {
  type ManagePage,
  useWorkspaceStore,
} from "../../../stores/workspace-store";

const manageItems: { id: ManagePage; label: string }[] = [
  { id: "general", label: "General" },
  { id: "providers", label: "Providers" },
];

/** Navigation list for the manage screen. */
export function ManageSidebar() {
  const managePage = useWorkspaceStore((state) => state.managePage);
  const setManagePage = useWorkspaceStore((state) => state.setManagePage);
  return (
    <nav className="manage-nav" dotbot-label="Manage">
      {manageItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`manage-nav-item ${managePage === item.id ? "is-active" : ""}`}
          dotbot-selected={String(managePage === item.id)}
          onClick={() => setManagePage(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
