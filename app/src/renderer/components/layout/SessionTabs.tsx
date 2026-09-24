/** Session tabs shown in the window's top strip while the workbench is open. */

import { For, Show } from "solid-js";
import { sessionStore } from "../../stores/session-store";
import { workspaceStore } from "../../stores/workspace-store";
import { ICON_BUTTON_CLASS } from "../panels/panel-classes";
import { statusDotClass } from "../panels/status-dot";

/** Render one tab per open session plus the new-session action. */
export function SessionTabs() {
  const sessionById = () => {
    const map = new Map(
      sessionStore.state.sessions.map((session) => [session.id, session]),
    );
    return map;
  };

  return (
    <div class="flex min-w-0 items-stretch self-stretch overflow-x-auto [-webkit-app-region:no-drag]">
      <For each={sessionStore.state.tabs}>
        {(id) => {
          const session = () => sessionById().get(id);
          return (
            <Show when={session()}>
              {(entry) => (
                <div class="flex max-w-[220px] shrink-0 items-stretch border-r border-widget-border">
                  <button
                    type="button"
                    class={`flex min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden border-t-2 px-2 text-meta ${
                      entry().id === sessionStore.state.selectedId
                        ? "border-tab-activeBorderTop bg-tab-activeBackground text-tab-activeForeground"
                        : "border-transparent bg-tab-inactiveBackground text-tab-inactiveForeground"
                    }`}
                    onClick={() => sessionStore.selectSession(entry().id)}
                  >
                    <span class={statusDotClass(entry().status)} />
                    <span class="truncate">
                      {entry().name ?? entry().title}
                    </span>
                  </button>
                  <button
                    class={ICON_BUTTON_CLASS}
                    type="button"
                    label={`Close ${entry().name ?? entry().title}`}
                    onClick={() => sessionStore.closeTab(entry().id)}
                  >
                    <span
                      class="codicon codicon-close text-xs"
                      decorative="true"
                    />
                  </button>
                </div>
              )}
            </Show>
          );
        }}
      </For>
      <button
        class={ICON_BUTTON_CLASS}
        type="button"
        label="New session"
        title="New session"
        onClick={() =>
          void sessionStore.startNewSession(
            workspaceStore.state.selectedProject,
          )
        }
      >
        <span class="codicon codicon-add text-xs" decorative="true" />
      </button>
    </div>
  );
}
