/** Workspace sidebar: every opened project with its sessions, below the navigation. */

import type { SessionSummary } from "@dotbot/agent-core";
import { createSignal, For, Show } from "solid-js";
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
  const [expanded, setExpanded] = createSignal(false);
  const limit = () =>
    props.active ? ACTIVE_SESSION_COUNT : OTHER_SESSION_COUNT;
  const hidden = () => props.sessions.length - limit();
  const visible = () =>
    expanded() || hidden() <= 0
      ? props.sessions
      : props.sessions.slice(0, limit());

  return (
    <div class="flex flex-col">
      <div
        class={`flex min-h-[30px] items-center gap-2 rounded-md px-2 text-body ${
          props.active ? "text-foreground" : "text-descriptionForeground"
        }`}
        title={props.projectDir}
      >
        <span
          class="codicon codicon-folder shrink-0 text-[15px] text-terminal-ansiBrightBlack"
          decorative="true"
        />
        <span class="min-w-0 flex-1 truncate">
          {projectName(props.projectDir)}
        </span>
        <button
          class={ICON_BUTTON_CLASS}
          type="button"
          label={`View files in ${projectName(props.projectDir)}`}
          title="View files"
          onClick={() => props.onBrowseFiles(props.projectDir)}
        >
          <span class="codicon codicon-files" decorative="true" />
        </button>
      </div>

      <For each={visible()}>
        {(session) => (
          <button
            class={`flex min-h-[30px] w-full cursor-pointer items-center gap-2 rounded-md border-0 py-0.5 pr-2 pl-6 text-left text-descriptionForeground hover:bg-list-hoverBackground hover:text-foreground ${
              props.openTabIds.includes(session.id)
                ? "bg-list-activeSelectionBackground text-list-activeSelectionForeground"
                : ""
            }`}
            type="button"
            onClick={() => props.onOpen(session.id)}
            title={`${session.title}\n${session.projectDir}`}
          >
            <span class={statusDotClass(session.status)} />
            <span class="min-w-0 flex-1 truncate text-body">
              {session.name ?? session.title}
            </span>
            <span class="shrink-0 text-meta text-disabledForeground tabular-nums">
              {relativeTime(session.lastActivity)}
            </span>
            <Show when={session.unread}>
              <span
                class="size-1.5 shrink-0 rounded-full bg-textLink-foreground"
                decorative="true"
              />
            </Show>
          </button>
        )}
      </For>

      <Show when={hidden() > 0}>
        <button
          class="min-h-[28px] w-full cursor-pointer rounded-md border-0 pr-2 pl-6 text-left text-meta text-terminal-ansiBrightBlack hover:bg-list-hoverBackground hover:text-foreground"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded() ? "Show less" : "Show more"}
        </button>
      </Show>
    </div>
  );
}

/**
 * Render the workspace section: every opened project, each followed by its
 * sessions. Projects keep their open order (newest first); selecting one never
 * moves it. Persisted sessions never add a project row.
 */
export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const sessionsByProject = () => {
    const map = new Map<string, SessionSummary[]>();
    for (const session of props.sessions) {
      const projectSessions = map.get(session.projectDir) ?? [];
      projectSessions.push(session);
      map.set(session.projectDir, projectSessions);
    }
    return map;
  };

  const projects = () => [...props.projects].reverse();

  return (
    <>
      <h2 class="px-3 pt-3 pb-1 text-meta text-descriptionForeground">
        Workspace
      </h2>
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        <Show
          when={projects().length > 0}
          fallback={
            <p class="px-1.5 py-3 text-meta leading-normal text-terminal-ansiBrightBlack">
              Open a project to start a session.
            </p>
          }
        >
          <For each={projects()}>
            {(dir) => (
              <ProjectSessions
                projectDir={dir}
                active={dir === props.projectDir}
                sessions={orderSessions(
                  sessionsByProject().get(dir) ?? [],
                  props.selectedSessionId,
                )}
                openTabIds={props.openTabIds}
                onOpen={props.onOpen}
                onBrowseFiles={props.onBrowseFiles}
              />
            )}
          </For>
        </Show>
      </div>
    </>
  );
}
