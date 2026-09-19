/** Task ordering inside one project row of the sidebar. */

import type { AgentSessionSummary } from "@dotbot/agent-core";

/** Selected task first, then running ones, then the most recently active. */
export function orderTasks(
  tasks: AgentSessionSummary[],
  selectedSessionId?: string,
): AgentSessionSummary[] {
  const priority = (session: AgentSessionSummary) =>
    session.id === selectedSessionId ? 0 : session.active ? 1 : 2;

  return [...tasks].sort(
    (a, b) =>
      priority(a) - priority(b) || b.lastActivity.localeCompare(a.lastActivity),
  );
}
