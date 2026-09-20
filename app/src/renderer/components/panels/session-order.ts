/** Session ordering inside one project row of the sidebar. */

import type { SessionSummary } from "@dotbot/agent-core";

/** Selected session first, then running ones, then the most recently active. */
export function orderSessions(
  sessions: SessionSummary[],
  selectedSessionId?: string,
): SessionSummary[] {
  const priority = (session: SessionSummary) =>
    session.id === selectedSessionId ? 0 : session.active ? 1 : 2;

  return [...sessions].sort(
    (a, b) =>
      priority(a) - priority(b) || b.lastActivity.localeCompare(a.lastActivity),
  );
}
