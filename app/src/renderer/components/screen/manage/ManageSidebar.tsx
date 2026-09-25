import { For, Show } from "solid-js";
import {
  type ManagePage,
  navigationStore,
} from "../../../stores/navigation-store";
import {
  CHROME_BUTTON_CLASS,
  NAV_ROW_CLASS,
  NAV_ROW_IDLE_CLASS,
  NAV_ROW_SELECTED_CLASS,
} from "../../panels/panel-classes";

const manageItems: { id: ManagePage; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "codicon-settings-gear" },
  { id: "providers", label: "Providers", icon: "codicon-server" },
];

/** Navigation list for the manage screen, prefixed by the way back. */
export function ManageSidebar(props: {
  onBack: () => void;
  collapsed: boolean;
}) {
  const managePage = () => navigationStore.state.managePage;

  return (
    <Show
      when={props.collapsed}
      fallback={
        <nav class="flex flex-col gap-0.5 p-2" label="Manage">
          <button
            type="button"
            class={`${NAV_ROW_CLASS} mb-1 ${NAV_ROW_IDLE_CLASS}`}
            label="Back to sessions"
            onClick={props.onBack}
          >
            <span
              class="codicon codicon-arrow-left text-[15px]"
              decorative="true"
            />
            Back
          </button>
          <For each={manageItems}>
            {(item) => (
              <button
                type="button"
                class={`${NAV_ROW_CLASS} ${
                  managePage() === item.id
                    ? NAV_ROW_SELECTED_CLASS
                    : NAV_ROW_IDLE_CLASS
                }`}
                is-selected={String(managePage() === item.id)}
                onClick={() => navigationStore.setManagePage(item.id)}
              >
                <span
                  class={`codicon ${item.icon} text-[15px]`}
                  decorative="true"
                />
                {item.label}
              </button>
            )}
          </For>
        </nav>
      }
    >
      <nav class="flex flex-col items-center gap-1 p-2" label="Manage">
        <button
          class={`size-7 ${CHROME_BUTTON_CLASS} mb-1`}
          type="button"
          label="Back to sessions"
          title="Back"
          onClick={props.onBack}
        >
          <span
            class="codicon codicon-arrow-left text-[15px]"
            decorative="true"
          />
        </button>
        <For each={manageItems}>
          {(item) => (
            <button
              type="button"
              class={`size-7 ${CHROME_BUTTON_CLASS} ${
                managePage() === item.id
                  ? "bg-list-activeSelectionBackground text-list-activeSelectionForeground"
                  : ""
              }`}
              label={item.label}
              title={item.label}
              is-selected={String(managePage() === item.id)}
              onClick={() => navigationStore.setManagePage(item.id)}
            >
              <span
                class={`codicon ${item.icon} text-[15px]`}
                decorative="true"
              />
            </button>
          )}
        </For>
      </nav>
    </Show>
  );
}
