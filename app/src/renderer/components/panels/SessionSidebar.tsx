import type { AgentSessionSummary } from "@dotbot/agent-core";
import {
  ICON_BUTTON_CLASS,
  PANEL_HEADING_CLASS,
  PANEL_TITLE_CLASS,
} from "./panel-classes";
import { statusDotClass } from "./status-dot";

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
    <details
      className={`group flex min-h-0 flex-none flex-col border-b border-border ${
        props.selected
          ? "grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden " +
            "[&::details-content]:flex [&::details-content]:min-h-0 " +
            "[&::details-content]:flex-col [&::details-content]:overflow-hidden"
          : ""
      }`}
      open={props.selected}
    >
      <summary
        className={`flex min-h-[28px] shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden border-b border-border bg-app px-2.5 text-[11px] text-muted select-none hover:bg-input hover:text-secondary [&::-webkit-details-marker]:hidden ${
          props.selected ? "sticky top-0 z-1" : ""
        }`}
        title={props.cwd}
      >
        <span
          className="codicon codicon-chevron-down text-[11px] transition-transform duration-100 group-open:rotate-0 rotate-[-90deg]"
          dotbot-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">
          {props.cwd.split(/[\\/]/).filter(Boolean).pop() ?? props.cwd}
        </span>
        <span className="text-[10px] text-faint">{props.sessions.length}</span>
      </summary>
      <div
        className={`min-h-0 overflow-y-auto pb-1 ${
          props.selected ? "max-h-none" : "max-h-[156px]"
        }`}
      >
        {props.sessions.length === 0 ? (
          <p className="mx-3.5 my-4 text-[11px] text-dim">No sessions</p>
        ) : (
          props.sessions.map((session) => (
            <button
              key={session.id}
              className={`flex min-h-[38px] w-full cursor-pointer items-center gap-1.5 border-0 border-l-2 border-l-transparent py-[5px] pr-2.5 pl-6 text-left text-muted hover:bg-input hover:text-secondary ${
                props.openTabIds.includes(session.id)
                  ? "border-l-accent bg-card text-secondary"
                  : ""
              }`}
              type="button"
              onClick={() => props.onOpen(session.id)}
              title={`${session.title}\n${session.cwd}`}
            >
              <span className={statusDotClass(session.status)} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[11px]">
                  {session.name ?? session.title}
                </span>
                <span className="truncate text-[10px] text-faint">
                  {statusText(session)}
                  {session.waiting && (
                    <span className="ml-1.5 text-warning">feedback</span>
                  )}
                </span>
              </span>
              {session.unread && (
                <span
                  className="size-1.5 rounded-full bg-accent"
                  dotbot-hidden="true"
                />
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
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className={`${PANEL_HEADING_CLASS} shrink-0 border-b border-border`}>
        <h1 className={`flex-1 ${PANEL_TITLE_CLASS}`}>Sessions</h1>
        <button
          className={ICON_BUTTON_CLASS}
          type="button"
          dotbot-label="New session"
          title="New session in current workspace"
          onClick={props.onNew}
        >
          <span className="codicon codicon-add" dotbot-hidden="true" />
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="mx-3.5 my-6 text-center text-[11px] leading-normal text-dim">
          No sessions yet. Open a workspace to start one.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-1.5">
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden">
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
          <div className="mt-auto flex max-h-[45%] min-h-0 flex-none flex-col overflow-y-auto">
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
