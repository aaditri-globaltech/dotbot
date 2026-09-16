import type { AgentSessionSummary } from "@aria/agent-core";

/** Inputs for the session list and workspace groups. */
export type SessionSidebarProps = {
  sessions: AgentSessionSummary[];
  openTabIds: string[];
  onOpen: (id: string) => void;
  onNew: () => void;
  selectedSessionId?: string;
  workspaceCwd?: string;
};

function statusText(session: AgentSessionSummary) {
  if (session.status === "waiting") return "Waiting";
  if (session.status === "running") return "Working";
  if (session.status === "starting") return "Starting";
  if (session.status === "error") return "Error";
  return session.active ? "Ready" : "Idle";
}

/** Group sessions by workspace and put the selected workspace first. */
export function groupSessions(
  sessions: AgentSessionSummary[],
  selectedWorkspace?: string,
  selectedSessionId?: string,
): Array<[string, AgentSessionSummary[]]> {
  const grouped = new Map<string, AgentSessionSummary[]>();
  for (const session of sessions) {
    const group = grouped.get(session.cwd) ?? [];
    group.push(session);
    grouped.set(session.cwd, group);
  }

  if (selectedWorkspace && !grouped.has(selectedWorkspace)) {
    grouped.set(selectedWorkspace, []);
  }

  const groups = [...grouped.entries()].map(
    ([cwd, group]): [string, AgentSessionSummary[]] => [
      cwd,
      group.sort((a, b) => {
        const priority = (session: AgentSessionSummary) =>
          session.id === selectedSessionId ? 0 : session.active ? 1 : 2;
        return (
          priority(a) - priority(b) ||
          (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "")
        );
      }),
    ],
  );
  const selectedIndex = groups.findIndex(([cwd]) => cwd === selectedWorkspace);
  if (selectedIndex > 0) {
    const [selected] = groups.splice(selectedIndex, 1);
    if (selected) groups.unshift(selected);
  }
  return groups;
}

type SessionGroupProps = {
  cwd: string;
  sessions: AgentSessionSummary[];
  selected: boolean;
  openTabIds: string[];
  onOpen: (id: string) => void;
};

function SessionGroup(props: SessionGroupProps) {
  return (
    <details className="session-cwd-group" open={props.selected}>
      <summary title={props.cwd}>
        <span className="codicon codicon-chevron-down" aria-hidden="true" />
        <span className="session-cwd-name">
          {props.cwd.split(/[\\/]/).filter(Boolean).pop() ?? props.cwd}
        </span>
        <span className="session-cwd-count">{props.sessions.length}</span>
      </summary>
      <div className="session-cwd-items">
        {props.sessions.length === 0 ? (
          <p className="session-group-empty">No sessions</p>
        ) : (
          props.sessions.map((session) => (
            <button
              key={session.id}
              className={`session-entry ${props.openTabIds.includes(session.id) ? "is-open" : ""}`}
              type="button"
              onClick={() => props.onOpen(session.id)}
              title={`${session.title}\n${session.cwd}`}
            >
              <span
                className={`agent-status-dot agent-status-dot-${session.status}`}
              />
              <span className="session-entry-content">
                <span className="session-entry-title">
                  {session.name ?? session.title}
                </span>
                <span className="session-entry-meta">
                  {statusText(session)}
                  {session.waiting && (
                    <span className="session-entry-feedback">feedback</span>
                  )}
                </span>
              </span>
              {session.unread && (
                <span className="session-entry-unread" aria-hidden="true" />
              )}
            </button>
          ))
        )}
      </div>
    </details>
  );
}

/** Render workspace-grouped Agent sessions and the new-session action. */
export function SessionSidebar(props: SessionSidebarProps) {
  const groups = groupSessions(
    props.sessions,
    props.workspaceCwd,
    props.selectedSessionId,
  );
  const selectedGroups = groups.filter(([cwd]) => cwd === props.workspaceCwd);
  const otherGroups = groups.filter(([cwd]) => cwd !== props.workspaceCwd);

  return (
    <div className="session-sidebar">
      <div className="session-sidebar-heading panel-heading">
        <h1>Sessions</h1>
        <button
          className="session-sidebar-action"
          type="button"
          aria-label="New session"
          title="New session in current workspace"
          onClick={props.onNew}
        >
          <span className="codicon codicon-add" aria-hidden="true" />
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="session-list-empty">
          No sessions yet. Open a workspace to start one.
        </p>
      ) : (
        <div className="session-list">
          <div className="session-selected-workspace">
            {selectedGroups.map(([cwd, sessions]) => (
              <SessionGroup
                key={cwd}
                cwd={cwd}
                sessions={sessions}
                selected
                openTabIds={props.openTabIds}
                onOpen={props.onOpen}
              />
            ))}
          </div>
          <div className="session-other-workspaces">
            {otherGroups.map(([cwd, sessions]) => (
              <SessionGroup
                key={cwd}
                cwd={cwd}
                sessions={sessions}
                selected={false}
                openTabIds={props.openTabIds}
                onOpen={props.onOpen}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
