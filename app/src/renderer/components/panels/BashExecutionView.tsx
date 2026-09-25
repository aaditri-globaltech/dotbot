/** Bash-mode block for a user-run command. */

import type { BashExecution } from "@dotbot/agent-core";
import { Show } from "solid-js";
import { createAutoScroll } from "../../hooks/auto-scroll";
import { CodeHighlight } from "./CodeHighlight";

/** `!!` commands render dim; plain `!` commands use the bash accent. */
function accentClasses(item: BashExecution) {
  return item.excludeFromContext
    ? { border: "border-bash-dim", header: "text-bash-dim" }
    : { border: "border-bash", header: "text-bash" };
}

/** Trailing status for a finished command; running commands show a loader. */
function completion(item: BashExecution) {
  if (item.status === "cancelled") {
    return {
      text: "(cancelled)",
      className: "text-gitDecoration-modifiedResourceForeground",
    };
  }
  if (item.status === "error") {
    return {
      text:
        item.exitCode === undefined ? "(failed)" : `(exit ${item.exitCode})`,
      className: "text-errorForeground",
    };
  }
  return undefined;
}

/** One user-run bash command with its streamed output. */
export function BashExecutionView(props: { item: BashExecution }) {
  const scroll = createAutoScroll<HTMLElement>(() => props.item.output);
  const accent = () => accentClasses(props.item);
  const status = () => completion(props.item);
  const hasStatus = () =>
    props.item.status !== "running" && (status() || props.item.truncated);

  return (
    // shrink-0 keeps the block at its content height inside the transcript's
    // scrollable flex column.
    <div
      class={`w-full max-w-full min-w-0 shrink-0 self-start border-t border-b px-2.5 py-1.5 font-mono text-mono ${accent().border}`}
    >
      <div
        class={`font-semibold [overflow-wrap:anywhere] [white-space:pre-wrap] ${accent().header}`}
      >
        $ {props.item.command}
      </div>
      <Show when={props.item.output}>
        <CodeHighlight
          code={props.item.output}
          language=""
          className="max-h-[180px] overflow-auto text-descriptionForeground [overflow-wrap:anywhere] [white-space:pre-wrap]"
          setElement={scroll.setElement}
          onScroll={scroll.onScroll}
        />
      </Show>
      <Show when={props.item.status === "running"}>
        <div class="flex items-center gap-1.5 pt-0.5 text-meta text-descriptionForeground">
          <span
            class={`codicon codicon-loading codicon-modifier-spin ${accent().header}`}
            decorative="true"
          />
          Running…
        </div>
      </Show>
      <Show when={hasStatus()}>
        <div class="flex flex-wrap items-center gap-x-2 pt-0.5 text-meta">
          <Show when={status()}>
            {(state) => <span class={state().className}>{state().text}</span>}
          </Show>
          <Show when={props.item.truncated}>
            <span class="min-w-0 text-gitDecoration-modifiedResourceForeground [overflow-wrap:anywhere]">
              Output truncated
              {props.item.fullOutputPath
                ? `. Full output: ${props.item.fullOutputPath}`
                : ""}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
