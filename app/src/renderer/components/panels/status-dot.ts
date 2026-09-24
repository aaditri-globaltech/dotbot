import type { SessionStatus } from "@dotbot/agent-core";

/** Tool and session states that render as a status dot. */
export type StatusDotState = SessionStatus | "success";

/**
 * Status dots for sessions, tabs, and tool calls. Literal class strings so
 * Tailwind emits them; the states come from runtime values.
 */
const DOT_CLASSES: Record<StatusDotState, string> = {
  idle: "bg-disabledForeground",
  starting: "bg-textLink-foreground shadow-[0_0_0_2px_rgb(72_160_199/18%)]",
  running: "bg-textLink-foreground shadow-[0_0_0_2px_rgb(72_160_199/18%)]",
  waiting:
    "bg-gitDecoration-modifiedResourceForeground shadow-[0_0_0_2px_rgb(229_186_125/18%)]",
  error: "bg-errorForeground",
  success:
    "bg-gitDecoration-untrackedResourceForeground shadow-[0_0_0_2px_rgb(115_201_145/18%)]",
};

/** Base dot shape plus the color for one state. */
export function statusDotClass(state: StatusDotState): string {
  return `inline-block size-[7px] shrink-0 rounded-full ${DOT_CLASSES[state]}`;
}
