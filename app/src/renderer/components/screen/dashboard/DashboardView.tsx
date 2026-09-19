/**
 * Home screen: launcher for recent work plus activity statistics, recent
 * projects, and recent sessions.
 */

import type { AgentSessionSummary } from "@dotbot/agent-core";
import { useMemo, useState } from "react";
import { useProjectDir } from "../../../hooks/useProjectDir";
import { projectName } from "../../../project-name";
import { relativeTime } from "../../../relative-time";
import { useAgentStore } from "../../../stores/agent-store";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { Hero } from "../../panels/Hero";
import { PanelHeader } from "../../panels/PanelHeader";
import { ActivityStatsPanel } from "./ActivityStatsPanel";

const MAX_RECENT_PROJECTS = 6;
const MAX_RECENT_SESSIONS = 5;

/** Shared presentation for recent project and session rows. */
const ROW_CLASS =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border " +
  "bg-card px-3 py-2 text-left hover:border-border-strong-hover " +
  "hover:bg-surface-hover focus-visible:border-border-strong-hover " +
  "focus-visible:bg-surface-hover";

/** Shared presentation for the two launcher actions. */
const ACTION_CLASS =
  "flex cursor-pointer items-center gap-3 rounded-xl border border-border-strong " +
  "bg-card px-4 py-3.5 text-left hover:border-border-strong-hover " +
  "hover:bg-surface-hover focus-visible:border-border-strong-hover " +
  "focus-visible:bg-surface-hover";

/** Icon chip used by the launcher actions. */
const ACTION_ICON_CLASS =
  "grid size-8 shrink-0 place-items-center rounded-lg bg-elevated text-base text-secondary";

/** Small muted heading above the recent lists. */
const SECTION_TITLE_CLASS = "mb-2 text-[11px] font-medium text-muted";

/** Newest activity first. */
function byRecentActivity(a: AgentSessionSummary, b: AgentSessionSummary) {
  return b.lastActivity.localeCompare(a.lastActivity);
}

/** Home launcher: stats, recent sessions, and recent projects. */
export function DashboardView() {
  const sessions = useAgentStore((state) => state.sessions);
  const startNewTask = useAgentStore((state) => state.startNewTask);
  const pickProject = useAgentStore((state) => state.pickProject);
  const openSession = useAgentStore((state) => state.openSession);
  const projects = useWorkspaceStore((state) => state.projects);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const setScreen = useWorkspaceStore((state) => state.setScreen);

  const [busy, setBusy] = useState(false);

  const projectDir = useProjectDir();

  // Projects are remembered in open order, so the newest are at the end.
  const recentProjects = useMemo(
    () => [...projects].reverse().slice(0, MAX_RECENT_PROJECTS),
    [projects],
  );
  const recentSessions = useMemo(
    () => [...sessions].sort(byRecentActivity).slice(0, MAX_RECENT_SESSIONS),
    [sessions],
  );

  /** Run an action with the page locked, so double clicks cannot race. */
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    void action()
      .catch((error: unknown) => console.error(error))
      .finally(() => setBusy(false));
  };

  const openFolder = async () => {
    if (!(await pickProject())) return;
    setScreen("workbench");
  };

  const newSession = async () => {
    await startNewTask(projectDir);
  };

  const showProject = (cwd: string) => {
    selectProject(cwd);
    setScreen("workbench");
  };

  const showSession = (id: string) => {
    openSession(id);
    setScreen("workbench");
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface">
      <PanelHeader title="Dashboard" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={`mx-auto max-w-[952px] px-8 py-12${
            busy ? " pointer-events-none opacity-60" : ""
          }`}
        >
          <header className="mb-6">
            <Hero
              title="Dotbot"
              hint="Open a project or pick up where you left off."
            />
          </header>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              className={ACTION_CLASS}
              onClick={() => run(openFolder)}
            >
              <span
                className={`${ACTION_ICON_CLASS} codicon codicon-folder-opened`}
                dotbot-hidden="true"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium text-primary">
                  Open project
                </span>
                <span className="truncate text-xs text-muted">
                  Pick a folder to work in
                </span>
              </span>
            </button>

            <button
              type="button"
              className={ACTION_CLASS}
              onClick={() => run(newSession)}
            >
              <span
                className={`${ACTION_ICON_CLASS} codicon codicon-add`}
                dotbot-hidden="true"
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium text-primary">
                  New task
                </span>
                <span className="truncate text-xs text-muted">
                  {projectDir
                    ? `In ${projectName(projectDir)}`
                    : "Pick a folder first"}
                </span>
              </span>
            </button>
          </div>

          <ActivityStatsPanel />

          <div className="grid grid-cols-2 items-start gap-6">
            <section>
              <h3 className={SECTION_TITLE_CLASS}>Recent tasks</h3>
              {recentSessions.length === 0 ? (
                <p className="text-xs text-dim">No tasks yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={ROW_CLASS}
                      title={session.name ?? session.title}
                      onClick={() => showSession(session.id)}
                    >
                      <span
                        className="codicon codicon-clock shrink-0 text-sm text-muted"
                        dotbot-hidden="true"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] text-secondary">
                          {session.name ?? session.title}
                        </span>
                        <span className="truncate text-[11px] text-dim">
                          {projectName(session.cwd)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-faint tabular-nums">
                        {relativeTime(session.lastActivity)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className={SECTION_TITLE_CLASS}>Recent projects</h3>
              {recentProjects.length === 0 ? (
                <p className="text-xs text-dim">No projects yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentProjects.map((cwd) => (
                    <button
                      key={cwd}
                      type="button"
                      className={ROW_CLASS}
                      title={cwd}
                      onClick={() => showProject(cwd)}
                    >
                      <span
                        className="codicon codicon-layers shrink-0 text-sm text-muted"
                        dotbot-hidden="true"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] text-secondary">
                          {projectName(cwd)}
                        </span>
                        <span className="truncate text-[11px] text-dim">
                          {cwd}
                        </span>
                      </span>
                      {cwd === projectDir && (
                        <span className="shrink-0 rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-secondary">
                          current
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
