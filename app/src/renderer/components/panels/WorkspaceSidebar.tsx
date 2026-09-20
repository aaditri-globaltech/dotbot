/** Workspace sidebar: every opened project with its sessions, below the navigation. */

import type { SessionSummary } from "@dotbot/agent-core";
import { useState } from "react";
import { projectName } from "../../project-name";
import { relativeTime } from "../../relative-time";
import { ICON_BUTTON_CLASS } from "./panel-classes";
import { orderSessions } from "./session-order";
import { statusDotClass } from "./status-dot";

/** Sessions shown before a project offers to expand: the active one shows more. */
const ACTIVE_SESSION_COUNT = 5;
const OTHER_SESSION_COUNT = 3;

/** Inputs for the session list grouped by project. */
export type WorkspaceSidebarProps = {
  sessions: SessionSummary[];
  openTabIds: string[];
  /** Every opened project, oldest first. */
  projects: string[];
  onOpen: (id: string) => void;
  onBrowseFiles: (projectDir: string) => void;
  selectedSessionId?: string;
  projectDir?: string;
};

type ProjectSessionsProps = {
  projectDir: string;
  /** Whether this is the project the composer and file tree point at. */
  active: boolean;
  sessions: SessionSummary[];
  openTabIds: string[];
  onOpen: (id: string) => void;
  onBrowseFiles: (projectDir: string) => void;
};

/** One project row followed by its sessions, capped until "Show more". */
function ProjectSessions(props: ProjectSessionsProps) {
  const [expanded, setExpanded] = useState(false);
  const limit = props.active ? ACTIVE_SESSION_COUNT : OTHER_SESSION_COUNT;
  const hidden = props.sessions.length - limit;
  const visible =
    expanded || hidden <= 0 ? props.sessions : props.sessions.slice(0, limit);

  return (
    <div className="flex flex-col">
      <div
        className={`flex min-h-[30px] items-center gap-2 rounded-md px-2 text-[13px] ${
          props.active ? "text-secondary" : "text-muted"
        }`}
        title={props.projectDir}
      >
        <span
          className="codicon codicon-folder shrink-0 text-[15px] text-dim"
          dotbot-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">
          {projectName(props.projectDir)}
        </span>
        <button
          className={ICON_BUTTON_CLASS}
          type="button"
          dotbot-label={`View files in ${projectName(props.projectDir)}`}
          title="View files"
          onClick={() => props.onBrowseFiles(props.projectDir)}
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
          title={`${session.title}\n${session.projectDir}`}
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
 * Render the workspace section: every opened project, each followed by its
 * sessions. Projects keep their open order (newest first); selecting one never
 * moves it. Persisted sessions never add a project row.
 */
export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const sessionsByProject = new Map<string, SessionSummary[]>();
  for (const session of props.sessions) {
    const projectSessions = sessionsByProject.get(session.projectDir) ?? [];
    projectSessions.push(session);
    sessionsByProject.set(session.projectDir, projectSessions);
  }

  const projects = [...props.projects].reverse();

  return (
    <>
      <h2 className="px-3.5 pt-3 pb-1 text-[12px] text-muted">Workspace</h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {projects.length === 0 ? (
          <p className="px-1.5 py-3 text-[12px] leading-normal text-dim">
            Open a project to start a session.
          </p>
        ) : (
          projects.map((projectDir) => (
            <ProjectSessions
              key={projectDir}
              projectDir={projectDir}
              active={projectDir === props.projectDir}
              sessions={orderSessions(
                sessionsByProject.get(projectDir) ?? [],
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
