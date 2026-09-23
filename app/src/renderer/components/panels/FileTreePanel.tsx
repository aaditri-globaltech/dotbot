/** Project file tree with Git markers, shown in place of the session list. */

import type { FileEntry } from "@dotbot/files";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { api } from "../../api";
import { errorMessage } from "../../errors";
import { createGitStatus } from "../../hooks/git-status";
import { projectName } from "../../project-name";
import { fileBadge } from "./file-badge";
import { gitMarkers } from "./git-markers";
import { ICON_BUTTON_CLASS } from "./panel-classes";

type FileTreePanelProps = {
  projectDir?: string;
  onPickProject: () => void;
};

type TreeRow = {
  entry: FileEntry;
  depth: number;
};

/** Render the lazy-loading project tree with Git status markers. */
export function FileTreePanel(props: FileTreePanelProps) {
  const [directories, setDirectories] = createSignal<
    Record<string, FileEntry[]>
  >({});
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set([""]));
  const [selectedPath, setSelectedPath] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  let loaded = new Set<string>();
  const git = createGitStatus(() => props.projectDir);
  const markers = () => gitMarkers(git.status());

  // Load folders on demand so large projects do not require a full tree upfront.
  const loadDirectory = async (projectDir: string, path: string) => {
    if (loaded.has(path)) return;
    loaded.add(path);

    try {
      const entries = await api.files.readDirectory(projectDir, path);
      if (props.projectDir !== projectDir) return;
      setDirectories((current) => ({ ...current, [path]: entries }));
    } catch (reason) {
      if (props.projectDir === projectDir) setError(errorMessage(reason));
    }
  };

  // Re-read every loaded directory so refreshes keep the current expansion.
  const refreshLoaded = async () => {
    const projectDir = props.projectDir;
    if (!projectDir) return;
    const paths = [...loaded];
    const results = await Promise.all(
      paths.map(async (path) => {
        try {
          return {
            path,
            entries: await api.files.readDirectory(projectDir, path),
          };
        } catch {
          return { path, entries: undefined };
        }
      }),
    );
    if (props.projectDir !== projectDir) return;

    const next: Record<string, FileEntry[]> = {};
    const removed = new Set<string>();
    for (const result of results) {
      if (result.entries) next[result.path] = result.entries;
      else removed.add(result.path);
    }
    if (removed.size > 0) {
      for (const path of removed) loaded.delete(path);
      setExpanded((current) => {
        const nextExpanded = new Set(current);
        for (const path of removed) {
          nextExpanded.delete(path);
          for (const candidate of nextExpanded) {
            if (candidate.startsWith(`${path}/`))
              nextExpanded.delete(candidate);
          }
        }
        return nextExpanded;
      });
    }
    setDirectories(next);
  };

  const reset = () => {
    loaded = new Set();
    setDirectories({});
    setExpanded(new Set([""]));
    setSelectedPath(undefined);
    setError(undefined);
  };

  createEffect(() => {
    const projectDir = props.projectDir;
    reset();
    if (projectDir) void loadDirectory(projectDir, "");
  });

  // The watcher lives with the tree: it runs while the explorer shows this
  // project and stops as soon as the explorer closes or the project changes.
  createEffect(() => {
    const projectDir = props.projectDir;
    if (!projectDir) return;

    const unsubscribe = api.files.onChanged((change) => {
      if (change.projectDir !== projectDir) return;
      // Git-internal updates are handled by the Git status reads, not the tree.
      const relevant = change.paths.some(
        (path) => path === "" || (path !== ".git" && !path.startsWith(".git/")),
      );
      if (relevant) void refreshLoaded();
    });
    void api.files
      .watch(projectDir)
      .catch((error: unknown) => console.error(error));

    onCleanup(() => {
      unsubscribe();
      void api.files.unwatch().catch((error: unknown) => console.error(error));
    });
  });

  const refresh = () => {
    const projectDir = props.projectDir;
    if (!projectDir) return;
    reset();
    void loadDirectory(projectDir, "");
  };

  const toggleDirectory = (path: string) => {
    if (expanded().has(path)) {
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
      return;
    }

    setExpanded((current) => new Set(current).add(path));
    if (props.projectDir) void loadDirectory(props.projectDir, path);
  };

  // Flatten only expanded folders into the rows rendered by the tree.
  const rows = createMemo(() => {
    const flattened: TreeRow[] = [];
    const visit = (path: string, depth: number) => {
      for (const entry of directories()[path] ?? []) {
        flattened.push({ entry, depth });
        if (entry.kind === "directory" && expanded().has(entry.path)) {
          visit(entry.path, depth + 1);
        }
      }
    };
    visit("", 0);
    return flattened;
  });

  // Row paths are stable strings, so <For> keeps each row's DOM (and focus)
  // while the row data is read reactively through the lookup below.
  const rowPaths = () => rows().map((row) => row.entry.path);
  const rowByPath = (path: string) =>
    rows().find((row) => row.entry.path === path);

  return (
    <Show
      when={props.projectDir}
      fallback={
        <p class="mx-3 my-4.5 text-[11px] leading-normal text-dim">
          Open a project to browse files.
        </p>
      }
    >
      {(projectDir) => (
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="flex min-h-[32px] shrink-0 items-center gap-1 px-2.5">
            <span
              class="min-w-0 flex-1 truncate text-[13px] text-secondary"
              title={projectDir()}
            >
              {projectName(projectDir())}
            </span>
            <button
              class={ICON_BUTTON_CLASS}
              type="button"
              label="Open project"
              title="Open a project"
              onClick={props.onPickProject}
            >
              <span class="codicon codicon-folder-opened" decorative="true" />
            </button>
            <button
              class={ICON_BUTTON_CLASS}
              type="button"
              label="Refresh file tree"
              title="Refresh file tree"
              onClick={refresh}
            >
              <span class="codicon codicon-refresh" decorative="true" />
            </button>
          </div>

          <div
            class="min-h-0 flex-1 overflow-auto px-1.5 pb-2"
            role="tree"
            label="Files"
          >
            <Show
              when={!error()}
              fallback={
                <p class="mx-2 my-4 text-[11px] leading-normal text-error">
                  {error()}
                </p>
              }
            >
              <For each={rowPaths()}>
                {(path) => (
                  <Show when={rowByPath(path)}>
                    {(row) => {
                      const directory = () => row().entry.kind === "directory";
                      const isExpanded = () => expanded().has(row().entry.path);
                      const selected = () =>
                        selectedPath() === row().entry.path;
                      const badge = () =>
                        directory() ? undefined : fileBadge(row().entry.name);
                      const letter = () =>
                        markers().files.get(row().entry.path);
                      const changedDirectory = () =>
                        directory() &&
                        markers().directories.has(row().entry.path);

                      return (
                        <button
                          class={`flex min-h-[30px] w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-0.5 pr-2 text-left text-[12px] text-secondary ${
                            selected()
                              ? "outline-1 outline-border-strong"
                              : "hover:bg-surface-hover focus-visible:bg-surface-hover"
                          }`}
                          type="button"
                          role="treeitem"
                          is-selected={String(selected())}
                          expanded={
                            directory() ? String(isExpanded()) : undefined
                          }
                          style={{
                            "padding-left": `${6 + row().depth * 14}px`,
                          }}
                          onClick={() => {
                            if (directory()) toggleDirectory(row().entry.path);
                            else setSelectedPath(row().entry.path);
                          }}
                        >
                          <Show
                            when={!directory()}
                            fallback={
                              <span
                                class={`codicon shrink-0 text-dim ${isExpanded() ? "codicon-chevron-down" : "codicon-chevron-right"}`}
                                decorative="true"
                              />
                            }
                          >
                            <Show
                              when={badge()}
                              fallback={
                                <span
                                  class="codicon codicon-file shrink-0 text-[13px] text-dim"
                                  decorative="true"
                                />
                              }
                            >
                              {(file) => (
                                <span
                                  class={`grid size-4 shrink-0 place-items-center rounded-sm text-[8px] leading-none font-semibold ${file().className}`}
                                  decorative="true"
                                >
                                  {file().label}
                                </span>
                              )}
                            </Show>
                          </Show>
                          <span
                            class={`min-w-0 flex-1 truncate ${changedDirectory() || letter() ? "text-success" : ""}`}
                          >
                            {row().entry.name}
                          </span>
                          <Show when={changedDirectory()}>
                            <span
                              class="size-1.5 shrink-0 rounded-full bg-success"
                              decorative="true"
                              title="Contains changes"
                            />
                          </Show>
                          <Show when={letter()}>
                            {(mark) => (
                              <span class="shrink-0 text-[11px] font-medium text-success">
                                {mark()}
                              </span>
                            )}
                          </Show>
                        </button>
                      );
                    }}
                  </Show>
                )}
              </For>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
