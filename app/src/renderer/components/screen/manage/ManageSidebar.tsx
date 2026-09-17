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
    <nav className="flex flex-col py-1" dotbot-label="Manage">
      {manageItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`cursor-pointer px-3.5 py-1.5 text-left ${
            managePage === item.id
              ? "bg-elevated text-primary"
              : "text-secondary hover:bg-surface-hover focus-visible:bg-surface-hover"
          }`}
          dotbot-selected={String(managePage === item.id)}
          onClick={() => setManagePage(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
