/** Trust choices rendered inside the composer's dialogue card. */

import type { ExtensionResponse, TrustRequest } from "@dotbot/agent-core";
import { createSignal, For, onMount } from "solid-js";

export type TrustPromptProps = {
  request: Extract<TrustRequest, { method: "select" }>;
  onRespond: (response: ExtensionResponse) => void;
};

/** Split the multi-line trust prompt into a heading and an explanation. */
function splitPrompt(title: string): { heading: string; detail?: string } {
  const [heading = "", ...rest] = title.split("\n");
  const detail = rest.join("\n").trim();
  return detail ? { heading, detail } : { heading };
}

/** Keyboard-navigable trust choices rendered in the composer's dialogue card. */
export function TrustPrompt(props: TrustPromptProps) {
  const options = props.request.options;
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let container: HTMLDivElement | undefined;
  const { heading, detail } = splitPrompt(props.request.title);

  onMount(() => container?.focus());

  const respond = (value: string) =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      value,
    });

  const cancel = () =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      cancelled: true,
    });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(options.length - 1, index + 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      respond(options[selectedIndex()]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div
      ref={(element) => {
        container = element;
      }}
      class="outline-none"
      tabindex={-1}
      role="listbox"
      label={heading}
      onKeyDown={handleKeyDown}
    >
      <div class="pb-2">
        <div class="text-read font-medium text-foreground">{heading}</div>
        {detail && (
          <div class="mt-1 text-body leading-normal text-terminal-ansiBrightBlack [white-space:pre-wrap]">
            {detail}
          </div>
        )}
      </div>
      <div class="-mx-3 flex flex-col gap-0.5">
        <For each={options}>
          {(option, index) => (
            <button
              type="button"
              role="option"
              is-selected={String(index() === selectedIndex())}
              class={`flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 px-3 py-2 text-left text-read ${
                index() === selectedIndex()
                  ? "bg-list-activeSelectionBackground text-list-activeSelectionForeground"
                  : "bg-transparent text-foreground hover:bg-list-hoverBackground"
              }`}
              onMouseEnter={() => setSelectedIndex(index())}
              onClick={() => respond(option)}
            >
              <span
                class={`codicon codicon-arrow-right w-4 shrink-0 text-[12px] text-textLink-foreground ${
                  index() === selectedIndex() ? "opacity-100" : "opacity-0"
                }`}
                decorative="true"
              />
              <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {option}
              </span>
            </button>
          )}
        </For>
      </div>
      <div class="pt-2.5 text-meta text-disabledForeground">
        ↑↓ navigate · Enter select · Esc cancel
      </div>
    </div>
  );
}
