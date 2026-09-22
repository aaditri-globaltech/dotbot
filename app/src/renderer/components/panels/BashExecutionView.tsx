/** Bash-mode block for a user-run command. */

import type { BashExecution } from "@dotbot/agent-core";
import { useAutoScroll } from "../../hooks/useAutoScroll";
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
    return { text: "(cancelled)", className: "text-warning" };
  }
  if (item.status === "error") {
    return {
      text:
        item.exitCode === undefined ? "(failed)" : `(exit ${item.exitCode})`,
      className: "text-error",
    };
  }
  return undefined;
}

/** One user-run bash command with its streamed output. */
export function BashExecutionView({ item }: { item: BashExecution }) {
  const scroll = useAutoScroll<HTMLElement>(item.output);
  const accent = accentClasses(item);
  const status = completion(item);
  const hasStatus = item.status !== "running" && (status || item.truncated);

  return (
    // shrink-0 keeps the block at its content height inside the transcript's
    // scrollable flex column.
    <div
      className={`w-full max-w-full min-w-0 shrink-0 self-start border-t border-b px-2.5 py-1.5 font-mono text-xs leading-[1.45] ${accent.border}`}
    >
      <div
        className={`font-semibold [overflow-wrap:anywhere] [white-space:pre-wrap] ${accent.header}`}
      >
        $ {item.command}
      </div>
      {item.output && (
        <CodeHighlight
          code={item.output}
          language=""
          className="max-h-[180px] overflow-auto text-muted [overflow-wrap:anywhere] [white-space:pre-wrap]"
          setElement={scroll.setElement}
          onScroll={scroll.onScroll}
        />
      )}
      {item.status === "running" && (
        <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted">
          <span
            className={`codicon codicon-loading codicon-modifier-spin ${accent.header}`}
            dotbot-hidden="true"
          />
          Running…
        </div>
      )}
      {hasStatus && (
        <div className="flex flex-wrap items-center gap-x-2 pt-0.5 text-[11px]">
          {status && <span className={status.className}>{status.text}</span>}
          {item.truncated && (
            <span className="min-w-0 text-warning [overflow-wrap:anywhere]">
              Output truncated
              {item.fullOutputPath
                ? `. Full output: ${item.fullOutputPath}`
                : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
