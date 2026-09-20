import type { SessionStatus } from "@dotbot/agent-core";

/** Tool and session states that render as a status dot. */
export type StatusDotState = SessionStatus | "success";

/**
 * Status dots for sessions, tabs, and tool calls. Literal class strings so
 * Tailwind emits them; the states come from runtime values.
 */
const DOT_CLASSES: Record<StatusDotState, string> = {
  idle: "bg-faint",
  starting: "bg-accent shadow-[0_0_0_2px_rgb(76_154_255/18%)]",
  running: "bg-accent shadow-[0_0_0_2px_rgb(76_154_255/18%)]",
  waiting: "bg-warning shadow-[0_0_0_2px_rgb(232_193_95/18%)]",
  error: "bg-error",
  success: "bg-success shadow-[0_0_0_2px_rgb(60_192_96/18%)]",
};

/** Base dot shape plus the color for one state. */
export function statusDotClass(state: StatusDotState): string {
  return `inline-block size-[7px] shrink-0 rounded-full ${DOT_CLASSES[state]}`;
}
