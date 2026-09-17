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
          className={`relative grid size-12 cursor-pointer place-items-center border-0 bg-transparent hover:text-primary focus-visible:ring-1 focus-visible:ring-focus ${
            props.selected === item.id
              ? "text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-accent before:content-['']"
              : "text-dim"
          }`}
          type="button"
          dotbot-label={item.label}
          dotbot-selected={String(props.selected === item.id)}
          title={item.label}
          onClick={() => props.onSelect(item.id)}
        >
          <span
            className={`codicon text-[22px] ${item.icon}`}
            dotbot-hidden="true"
          />
        </button>
      ))}
    </>
  );
}

/** Render the primary activity-bar navigation. */
export function ActivityBar(props: ActivityBarProps) {
  return (
    <nav
      className="flex min-h-0 flex-col justify-between border-r border-border bg-app py-2"
      dotbot-label="Activity Bar"
    >
      <div className="flex flex-col items-center gap-1">
        <ActivityItems {...props} items={topItems} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <ActivityItems {...props} items={bottomItems} />
      </div>
    </nav>
  );
}
