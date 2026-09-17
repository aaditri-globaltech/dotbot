import type { AgentStatus } from "@dotbot/agent-core";

/** Tool and session states that render as a status dot. */
export type StatusDotState = AgentStatus | "success";

/**
 * Status dots for sessions, tabs, and tool calls. Literal class strings so
 * Tailwind emits them; the states come from runtime values.
 */
const DOT_CLASSES: Record<StatusDotState, string> = {
  idle: "bg-faint",
  ready: "bg-faint",
  starting: "bg-accent shadow-[0_0_0_2px_rgb(55_148_255/15%)]",
  running: "bg-accent shadow-[0_0_0_2px_rgb(55_148_255/15%)]",
  waiting: "bg-warning shadow-[0_0_0_2px_rgb(226_192_141/15%)]",
  error: "bg-error",
  success: "bg-success shadow-[0_0_0_2px_rgb(137_209_133/15%)]",
};

/** Base dot shape plus the color for one state. */
export function statusDotClass(state: StatusDotState): string {
  return `inline-block size-[7px] shrink-0 rounded-full ${DOT_CLASSES[state]}`;
}
