import type { Screen } from "../../stores/workspace-store";

type ActivityItem = {
  id: Screen;
  icon: string;
  label: string;
};

const topItems: ActivityItem[] = [
  { id: "dashboard", icon: "codicon-home", label: "Dashboard" },
  { id: "workbench", icon: "codicon-project", label: "Workbench" },
];

const bottomItems: ActivityItem[] = [
  { id: "manage", icon: "codicon-settings-gear", label: "Manage" },
];

/** Inputs for the activity-bar screen selector. */
export type ActivityBarProps = {
  selected: Screen;
  onSelect: (screen: Screen) => void;
};

function ActivityItems(props: ActivityBarProps & { items: ActivityItem[] }) {
  return (
    <>
      {props.items.map((item) => (
        <button
          key={item.id}
          className={`activity-icon ${props.selected === item.id ? "is-active" : ""}`}
          type="button"
          dotbot-label={item.label}
          dotbot-selected={String(props.selected === item.id)}
          title={item.label}
          onClick={() => props.onSelect(item.id)}
        >
          <span className={`codicon ${item.icon}`} dotbot-hidden="true" />
        </button>
      ))}
    </>
  );
}

/** Render the primary activity-bar navigation. */
export function ActivityBar(props: ActivityBarProps) {
  return (
    <nav className="activity-bar" dotbot-label="Activity Bar">
      <div className="activity-items">
        <ActivityItems {...props} items={topItems} />
      </div>
      <div className="activity-items activity-items-bottom">
        <ActivityItems {...props} items={bottomItems} />
      </div>
    </nav>
  );
}
