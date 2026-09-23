/**
 * Home screen: launcher for recent work plus activity statistics, recent
 * projects, and recent sessions.
 */

import type { SessionSummary } from "@dotbot/agent-core";
import { createMemo, createSignal, For, Show } from "solid-js";
import { projectName } from "../../../project-name";
import { relativeTime } from "../../../relative-time";
import { navigationStore } from "../../../stores/navigation-store";
import { sessionStore } from "../../../stores/session-store";
import { workspaceStore } from "../../../stores/workspace-store";
import { Hero } from "../../panels/Hero";
import { PanelHeader } from "../../panels/PanelHeader";
import { UsageStatsPanel } from "./UsageStatsPanel";

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
function byRecentActivity(a: SessionSummary, b: SessionSummary) {
  return b.lastActivity.localeCompare(a.lastActivity);
}

/** Home launcher: stats, recent sessions, and recent projects. */
export function DashboardView() {
  const [busy, setBusy] = createSignal(false);

  // Projects are remembered in open order, so the newest are at the end.
  const recentProjects = createMemo(() =>
    [...workspaceStore.state.projects].reverse().slice(0, MAX_RECENT_PROJECTS),
  );
  const recentSessions = createMemo(() =>
    [...sessionStore.state.sessions]
      .sort(byRecentActivity)
      .slice(0, MAX_RECENT_SESSIONS),
  );

  /** Run an action with the page locked, so double clicks cannot race. */
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    void action()
      .catch((error: unknown) => console.error(error))
      .finally(() => setBusy(false));
  };

  const openFolder = async () => {
    if (!(await sessionStore.pickProject())) return;
    navigationStore.setScreen("workbench");
  };

  const newSession = async () => {
    await sessionStore.startNewSession(workspaceStore.state.selectedProject);
  };

  const showProject = (dir: string) => {
    workspaceStore.selectProject(dir);
    navigationStore.setScreen("workbench");
  };

  const showSession = (id: string) => {
    sessionStore.openSession(id);
    navigationStore.setScreen("workbench");
  };

  return (
    <div class="flex h-full min-h-0 w-full flex-col bg-surface">
      <PanelHeader title="Dashboard" />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <div
          class={`mx-auto max-w-[952px] px-8 py-12${
            busy() ? " pointer-events-none opacity-60" : ""
          }`}
        >
          <header class="mb-6">
            <Hero
              title="Dotbot"
              hint="Open a project or pick up where you left off."
            />
          </header>

          <div class="mb-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              class={ACTION_CLASS}
              onClick={() => run(openFolder)}
            >
              <span
                class={`${ACTION_ICON_CLASS} codicon codicon-folder-opened`}
                decorative="true"
              />
              <span class="flex min-w-0 flex-col">
                <span class="text-[13px] font-medium text-primary">
                  Open project
                </span>
                <span class="truncate text-xs text-muted">
                  Pick a folder to work in
                </span>
              </span>
            </button>

            <button
              type="button"
              class={ACTION_CLASS}
              onClick={() => run(newSession)}
            >
              <span
                class={`${ACTION_ICON_CLASS} codicon codicon-add`}
                decorative="true"
              />
              <span class="flex min-w-0 flex-col">
                <span class="text-[13px] font-medium text-primary">
                  New session
                </span>
                <span class="truncate text-xs text-muted">
                  {workspaceStore.state.selectedProject
                    ? `In ${projectName(workspaceStore.state.selectedProject)}`
                    : "Pick a folder first"}
                </span>
              </span>
            </button>
          </div>

          <UsageStatsPanel />

          <div class="grid grid-cols-2 items-start gap-6">
            <section>
              <h3 class={SECTION_TITLE_CLASS}>Recent sessions</h3>
              <Show
                when={recentSessions().length > 0}
                fallback={<p class="text-xs text-dim">No sessions yet.</p>}
              >
                <div class="flex flex-col gap-1.5">
                  <For each={recentSessions()}>
                    {(session) => (
                      <button
                        type="button"
                        class={ROW_CLASS}
                        title={session.name ?? session.title}
                        onClick={() => showSession(session.id)}
                      >
                        <span
                          class="codicon codicon-clock shrink-0 text-sm text-muted"
                          decorative="true"
                        />
                        <span class="flex min-w-0 flex-1 flex-col">
                          <span class="truncate text-[13px] text-secondary">
                            {session.name ?? session.title}
                          </span>
                          <span class="truncate text-[11px] text-dim">
                            {projectName(session.projectDir)}
                          </span>
                        </span>
                        <span class="shrink-0 text-[10px] text-faint tabular-nums">
                          {relativeTime(session.lastActivity)}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </section>

            <section>
              <h3 class={SECTION_TITLE_CLASS}>Recent projects</h3>
              <Show
                when={recentProjects().length > 0}
                fallback={<p class="text-xs text-dim">No projects yet.</p>}
              >
                <div class="flex flex-col gap-1.5">
                  <For each={recentProjects()}>
                    {(recentProject) => (
                      <button
                        type="button"
                        class={ROW_CLASS}
                        title={recentProject}
                        onClick={() => showProject(recentProject)}
                      >
                        <span
                          class="codicon codicon-layers shrink-0 text-sm text-muted"
                          decorative="true"
                        />
                        <span class="flex min-w-0 flex-1 flex-col">
                          <span class="truncate text-[13px] text-secondary">
                            {projectName(recentProject)}
                          </span>
                          <span class="truncate text-[11px] text-dim">
                            {recentProject}
                          </span>
                        </span>
                        <Show
                          when={
                            recentProject ===
                            workspaceStore.state.selectedProject
                          }
                        >
                          <span class="shrink-0 rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-secondary">
                            current
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
