/** Workspace sidebar: every added project with its tasks, below the navigation. */

import type { AgentSessionSummary } from "@dotbot/agent-core";
import { useState } from "react";
import { relativeTime } from "../../relative-time";
import { workspaceName } from "../../workspace-name";
import { ICON_BUTTON_CLASS } from "./panel-classes";
import { statusDotClass } from "./status-dot";
import { orderTasks } from "./task-order";

/** Tasks shown before a project offers to expand: the active one shows more. */
const ACTIVE_TASK_COUNT = 5;
const OTHER_TASK_COUNT = 3;

/** Inputs for the task list grouped by workspace. */
export type WorkspaceSidebarProps = {
  sessions: AgentSessionSummary[];
  openTabIds: string[];
  /** Every added project, oldest first. */
  workspaces: string[];
  onOpen: (id: string) => void;
  onBrowseFiles: (cwd: string) => void;
  selectedSessionId?: string;
  workspaceCwd?: string;
};

type WorkspaceTasksProps = {
  cwd: string;
  /** Whether this is the project the composer and file tree point at. */
  active: boolean;
  sessions: AgentSessionSummary[];
  openTabIds: string[];
  onOpen: (id: string) => void;
  onBrowseFiles: (cwd: string) => void;
};

/** One project row followed by its tasks, capped until "Show more". */
function WorkspaceTasks(props: WorkspaceTasksProps) {
  const [expanded, setExpanded] = useState(false);
  const limit = props.active ? ACTIVE_TASK_COUNT : OTHER_TASK_COUNT;
  const hidden = props.sessions.length - limit;
  const visible =
    expanded || hidden <= 0 ? props.sessions : props.sessions.slice(0, limit);

  return (
    <div className="flex flex-col">
      <div
        className={`flex min-h-[30px] items-center gap-2 rounded-md px-2 text-[13px] ${
          props.active ? "text-secondary" : "text-muted"
        }`}
        title={props.cwd}
      >
        <span
          className="codicon codicon-folder shrink-0 text-[15px] text-dim"
          dotbot-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">
          {workspaceName(props.cwd)}
        </span>
        <button
          className={ICON_BUTTON_CLASS}
          type="button"
          dotbot-label={`View files in ${workspaceName(props.cwd)}`}
          title="View files"
          onClick={() => props.onBrowseFiles(props.cwd)}
        >
          <span className="codicon codicon-files" dotbot-hidden="true" />
        </button>
      </div>

      {visible.map((session) => (
        <button
          key={session.id}
          className={`flex min-h-[30px] w-full cursor-pointer items-center gap-2 rounded-md border-0 py-0.5 pr-2 pl-7 text-left text-muted hover:bg-surface-hover hover:text-secondary ${
            props.openTabIds.includes(session.id)
              ? "bg-card text-secondary"
              : ""
          }`}
          type="button"
          onClick={() => props.onOpen(session.id)}
          title={`${session.title}\n${session.cwd}`}
        >
          <span className={statusDotClass(session.status)} />
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {session.name ?? session.title}
          </span>
          <span className="shrink-0 text-[11px] text-faint tabular-nums">
            {relativeTime(session.lastActivity)}
          </span>
          {session.unread && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-accent"
              dotbot-hidden="true"
            />
          )}
        </button>
      ))}

      {hidden > 0 && (
        <button
          className="min-h-[28px] w-full cursor-pointer rounded-md border-0 pr-2 pl-7 text-left text-[12px] text-dim hover:bg-surface-hover hover:text-secondary"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * Render the workspace section: every added project, each followed by its tasks.
 * The selected project comes first; remembered projects keep their open order.
 */
export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const tasksByProject = new Map<string, AgentSessionSummary[]>();
  for (const session of props.sessions) {
    const tasks = tasksByProject.get(session.cwd) ?? [];
    tasks.push(session);
    tasksByProject.set(session.cwd, tasks);
  }

  const projects = [
    ...new Set([
      ...(props.workspaceCwd ? [props.workspaceCwd] : []),
      ...[...props.workspaces].reverse(),
      ...props.sessions.map((session) => session.cwd),
    ]),
  ];

  return (
    <>
      <h2 className="px-3.5 pt-3 pb-1 text-[12px] text-muted">Workspace</h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {projects.length === 0 ? (
          <p className="px-1.5 py-3 text-[12px] leading-normal text-dim">
            Open a project to start a task.
          </p>
        ) : (
          projects.map((cwd) => (
            <WorkspaceTasks
              key={cwd}
              cwd={cwd}
              active={cwd === props.workspaceCwd}
              sessions={orderTasks(
                tasksByProject.get(cwd) ?? [],
                props.selectedSessionId,
              )}
              openTabIds={props.openTabIds}
              onOpen={props.onOpen}
              onBrowseFiles={props.onBrowseFiles}
            />
          ))
        )}
      </div>
    </>
  );
}
