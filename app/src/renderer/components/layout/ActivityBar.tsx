/** View identifiers shown in the activity bar. */
export type ActivityView =
  | "explorer"
  | "search"
  | "source-control"
  | "run-and-debug"
  | "extensions"
  | "accounts"
  | "manage";

type ActivityItem = {
  id: ActivityView;
  icon: string;
  label: string;
};

const activityItems: ActivityItem[] = [
  { id: "explorer", icon: "codicon-files", label: "Explorer" },
  { id: "search", icon: "codicon-search", label: "Search" },
  {
    id: "source-control",
    icon: "codicon-source-control",
    label: "Source Control",
  },
  { id: "run-and-debug", icon: "codicon-run-all", label: "Run and Debug" },
  { id: "extensions", icon: "codicon-extensions", label: "Extensions" },
];

const bottomActivityItems: ActivityItem[] = [
  { id: "accounts", icon: "codicon-account", label: "Accounts" },
  { id: "manage", icon: "codicon-settings-gear", label: "Manage" },
];

/** Inputs for the activity-bar view selector. */
export type ActivityBarProps = {
  selected: ActivityView;
  onSelect: (view: ActivityView) => void;
};

function ActivityItems(props: ActivityBarProps & { items: ActivityItem[] }) {
  return (
    <>
      {props.items.map((item) => (
        <button
          key={item.id}
          className={`activity-icon ${props.selected === item.id ? "is-active" : ""}`}
          type="button"
          aria-label={item.label}
          aria-pressed={props.selected === item.id}
          title={item.label}
          onClick={() => props.onSelect(item.id)}
        >
          <span className={`codicon ${item.icon}`} aria-hidden="true" />
        </button>
      ))}
    </>
  );
}

/** Render the primary activity-bar navigation. */
export function ActivityBar(props: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Activity Bar">
      <div className="activity-items">
        <ActivityItems {...props} items={activityItems} />
      </div>
      <div className="activity-items activity-items-bottom">
        <ActivityItems {...props} items={bottomActivityItems} />
      </div>
    </nav>
  );
}
