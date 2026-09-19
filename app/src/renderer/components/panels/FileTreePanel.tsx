/** Workspace file tree with Git markers, shown in place of the task list. */

import type { ExplorerEntry } from "@dotbot/workspace";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { errorMessage } from "../../errors";
import { useGitStatus } from "../../hooks/useGitStatus";
import { workspaceName } from "../../workspace-name";
import { fileBadge } from "./file-badge";
import { gitMarkers } from "./git-markers";
import { ICON_BUTTON_CLASS } from "./panel-classes";

type FileTreePanelProps = {
  cwd?: string;
  onPickWorkspace: () => void;
};

type TreeRow = {
  entry: ExplorerEntry;
  depth: number;
};

/** Render the lazy-loading workspace tree with Git status markers. */
export function FileTreePanel(props: FileTreePanelProps) {
  const [directories, setDirectories] = useState<
    Record<string, ExplorerEntry[]>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
  const [selectedPath, setSelectedPath] = useState<string>();
  const [error, setError] = useState<string>();
  const loadedRef = useRef(new Set<string>());
  const gitStatus = useGitStatus(props.cwd);
  const markers = gitMarkers(gitStatus);

  // Load folders on demand so large workspaces do not require a full tree upfront.
  const loadDirectory = useCallback(
    async (cwd: string, path: string) => {
      if (loadedRef.current.has(path)) return;
      loadedRef.current.add(path);

      try {
        const entries = await api.workspace.readDirectory(cwd, path);
        if (props.cwd !== cwd) return;
        setDirectories((current) => ({ ...current, [path]: entries }));
      } catch (reason) {
        if (props.cwd === cwd) {
          setError(errorMessage(reason));
        }
      }
    },
    [props.cwd],
  );

  // Re-read every loaded directory so refreshes keep the current expansion.
  const refreshLoaded = useCallback(async () => {
    const cwd = props.cwd;
    if (!cwd) return;
    const paths = [...loadedRef.current];
    const results = await Promise.all(
      paths.map(async (path) => {
        try {
          return {
            path,
            entries: await api.workspace.readDirectory(cwd, path),
          };
        } catch {
          return { path, entries: undefined };
        }
      }),
    );
    if (props.cwd !== cwd) return;

    const next: Record<string, ExplorerEntry[]> = {};
    const removed = new Set<string>();
    for (const result of results) {
      if (result.entries) next[result.path] = result.entries;
      else removed.add(result.path);
    }
    if (removed.size > 0) {
      for (const path of removed) loadedRef.current.delete(path);
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
  }, [props.cwd]);

  const reset = useCallback(() => {
    loadedRef.current = new Set();
    setDirectories({});
    setExpanded(new Set([""]));
    setSelectedPath(undefined);
    setError(undefined);
  }, []);

  useEffect(() => {
    reset();
    if (props.cwd) void loadDirectory(props.cwd, "");
  }, [props.cwd, loadDirectory, reset]);

  // The watcher lives with the tree: it runs while the explorer shows this
  // workspace and stops as soon as the explorer closes or the project changes.
  useEffect(() => {
    const cwd = props.cwd;
    if (!cwd) return;

    const unsubscribe = api.workspace.onChanged((change) => {
      if (change.cwd !== cwd) return;
      // Git-internal updates are handled by the Git status reads, not the tree.
      const relevant = change.paths.some(
        (path) => path === "" || (path !== ".git" && !path.startsWith(".git/")),
      );
      if (relevant) void refreshLoaded();
    });
    void api.workspace
      .watch(cwd)
      .catch((error: unknown) => console.error(error));

    return () => {
      unsubscribe();
      void api.workspace
        .unwatch()
        .catch((error: unknown) => console.error(error));
    };
  }, [props.cwd, refreshLoaded]);

  const refresh = () => {
    const cwd = props.cwd;
    if (!cwd) return;
    reset();
    void loadDirectory(cwd, "");
  };

  const toggleDirectory = (path: string) => {
    if (expanded.has(path)) {
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
      return;
    }

    setExpanded((current) => new Set(current).add(path));
    if (props.cwd) void loadDirectory(props.cwd, path);
  };

  // Flatten only expanded folders into the rows rendered by the tree.
  const rows: TreeRow[] = [];
  const visit = (path: string, depth: number) => {
    for (const entry of directories[path] ?? []) {
      rows.push({ entry, depth });
      if (entry.kind === "directory" && expanded.has(entry.path)) {
        visit(entry.path, depth + 1);
      }
    }
  };
  visit("", 0);

  if (!props.cwd) {
    return (
      <p className="mx-3 my-4.5 text-[11px] leading-normal text-dim">
        Open a project to browse files.
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[32px] shrink-0 items-center gap-1 px-2.5">
        <span
          className="min-w-0 flex-1 truncate text-[13px] text-secondary"
          title={props.cwd}
        >
          {workspaceName(props.cwd)}
        </span>
        <button
          className={ICON_BUTTON_CLASS}
          type="button"
          dotbot-label="Open project"
          title="Open a project and start a task"
          onClick={props.onPickWorkspace}
        >
          <span
            className="codicon codicon-folder-opened"
            dotbot-hidden="true"
          />
        </button>
        <button
          className={ICON_BUTTON_CLASS}
          type="button"
          dotbot-label="Refresh file tree"
          title="Refresh file tree"
          onClick={refresh}
        >
          <span className="codicon codicon-refresh" dotbot-hidden="true" />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto px-1.5 pb-2"
        role="tree"
        dotbot-label="Files"
      >
        {error ? (
          <p className="mx-2 my-4 text-[11px] leading-normal text-error">
            {error}
          </p>
        ) : (
          rows.map((row) => {
            const directory = row.entry.kind === "directory";
            const isExpanded = expanded.has(row.entry.path);
            const selected = selectedPath === row.entry.path;
            const badge = directory ? undefined : fileBadge(row.entry.name);
            const letter = markers.files.get(row.entry.path);
            const changedDirectory =
              directory && markers.directories.has(row.entry.path);

            return (
              <button
                key={row.entry.path}
                className={`flex min-h-[30px] w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent py-0.5 pr-2 text-left text-[12px] text-secondary ${
                  selected
                    ? "outline-1 outline-border-strong"
                    : "hover:bg-surface-hover focus-visible:bg-surface-hover"
                }`}
                type="button"
                role="treeitem"
                dotbot-selected={String(selected)}
                dotbot-expanded={directory ? String(isExpanded) : undefined}
                style={{ paddingLeft: `${6 + row.depth * 14}px` }}
                onClick={() => {
                  if (directory) toggleDirectory(row.entry.path);
                  else setSelectedPath(row.entry.path);
                }}
              >
                {directory ? (
                  <span
                    className={`codicon shrink-0 text-dim ${isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
                    dotbot-hidden="true"
                  />
                ) : badge ? (
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded-sm text-[8px] leading-none font-semibold ${badge.className}`}
                    dotbot-hidden="true"
                  >
                    {badge.label}
                  </span>
                ) : (
                  <span
                    className="codicon codicon-file shrink-0 text-[13px] text-dim"
                    dotbot-hidden="true"
                  />
                )}
                <span
                  className={`min-w-0 flex-1 truncate ${changedDirectory || letter ? "text-success" : ""}`}
                >
                  {row.entry.name}
                </span>
                {changedDirectory && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-success"
                    dotbot-hidden="true"
                    title="Contains changes"
                  />
                )}
                {letter && (
                  <span className="shrink-0 text-[11px] font-medium text-success">
                    {letter}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
