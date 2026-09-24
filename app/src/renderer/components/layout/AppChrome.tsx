/** Window chrome: the sidebar brand row and the main title strip. */

import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
import { api } from "../../api";
import { ICON_BUTTON_CLASS } from "../panels/panel-classes";
import { ViewActions, type ViewActionsProps } from "../panels/ViewActions";

const WINDOW_BUTTON_CLASS = `${ICON_BUTTON_CLASS} [-webkit-app-region:no-drag]`;

/** Brand row pinned at the top of the sidebar, doubling as a drag handle. */
export function SidebarBrand(props: { collapsed: boolean }) {
  return (
    <div
      class={`app-drag flex min-h-[34px] shrink-0 items-center gap-2 ${
        props.collapsed ? "justify-center px-0" : "px-3"
      }`}
    >
      <span
        class="codicon codicon-hubot text-[15px] text-textLink-foreground"
        decorative="true"
      />
      <Show when={!props.collapsed}>
        <span class="text-body font-medium text-foreground">Dotbot</span>
      </Show>
    </div>
  );
}

/** Title strip above the view: session tabs, layout actions, and window controls. */
export function MainTopBar(
  props: ViewActionsProps & { children?: JSX.Element },
) {
  const [maximized, setMaximized] = createSignal(false);

  onMount(() => {
    // The main process owns the real window state; keep the icon synchronized.
    const unsubscribe = api.window.onMaximizedChange(setMaximized);
    onCleanup(unsubscribe);
  });

  return (
    <div class="app-drag flex items-center gap-1 pr-0 pl-3">
      {props.children}
      <ViewActions
        panelCollapsed={props.panelCollapsed}
        primarySidebarCollapsed={props.primarySidebarCollapsed}
        onTogglePanel={props.onTogglePanel}
        onTogglePrimarySidebar={props.onTogglePrimarySidebar}
      />
      <div class="ml-2 flex items-center gap-1">
        <button
          class={WINDOW_BUTTON_CLASS}
          type="button"
          label="Minimize window"
          onClick={() => api.window.minimize()}
        >
          <span
            class="codicon codicon-chrome-minimize text-[13px]"
            decorative="true"
          />
        </button>
        <button
          class={WINDOW_BUTTON_CLASS}
          type="button"
          label={maximized() ? "Restore window" : "Maximize window"}
          onClick={() => api.window.toggleMaximize()}
        >
          <span
            class={`codicon text-[13px] ${maximized() ? "codicon-chrome-restore" : "codicon-chrome-maximize"}`}
            decorative="true"
          />
        </button>
        <button
          class={`${WINDOW_BUTTON_CLASS} hover:bg-window-close hover:text-strongForeground`}
          type="button"
          label="Close window"
          onClick={() => api.window.close()}
        >
          <span
            class="codicon codicon-chrome-close text-[13px]"
            decorative="true"
          />
        </button>
      </div>
    </div>
  );
}
