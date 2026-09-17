import type { ExplorerEntry } from "@dotbot/workspace";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { errorMessage } from "../../errors";

type ExplorerSidebarProps = {
  cwd?: string;
  workspaces: string[];
  onSelectWorkspace: (cwd: string) => void;
  onPickWorkspace: () => void;
};

type ExplorerRow = {
  entry: ExplorerEntry;
  depth: number;
};

function workspaceName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Render the lazy-loading workspace file tree. */
export function ExplorerSidebar(props: ExplorerSidebarProps) {
  const [directories, setDirectories] = useState<
    Record<string, ExplorerEntry[]>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));
  const [selectedPath, setSelectedPath] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const loadedRef = useRef(new Set<string>());

  // Load folders on demand so large workspaces do not require a full tree upfront.
  const loadDirectory = useCallback(
    async (cwd: string, path: string) => {
      if (loadedRef.current.has(path)) return;
      loadedRef.current.add(path);

      setLoading(true);
      try {
        const entries = await api.workspace.readDirectory(cwd, path);
        if (props.cwd !== cwd) return;
        setDirectories((current) => ({ ...current, [path]: entries }));
      } catch (reason) {
        if (props.cwd === cwd) {
          setError(errorMessage(reason));
        }
      } finally {
        setLoading(false);
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

  // Refresh the tree when files change, ignoring Git-internal updates.
  useEffect(() => {
    const cwd = props.cwd;
    if (!cwd) return;
    return api.workspace.onChanged((change) => {
      if (change.cwd !== cwd) return;
      const relevant = change.paths.some(
        (path) => path === "" || (path !== ".git" && !path.startsWith(".git/")),
      );
      if (relevant) void refreshLoaded();
    });
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
  const visibleEntries: ExplorerRow[] = [];
  const visit = (path: string, depth: number) => {
    for (const entry of directories[path] ?? []) {
      visibleEntries.push({ entry, depth });
      if (entry.kind === "directory" && expanded.has(entry.path)) {
        visit(entry.path, depth + 1);
      }
    }
  };
  visit("", 0);

  return (
    <div className="explorer-sidebar">
      {!props.cwd ? (
        <p className="sidebar-empty">Open a workspace to browse files.</p>
      ) : (
        <>
          <div className="explorer-workspace">
            <select
              className="explorer-workspace-selector"
              dotbot-label="Workspace"
              title={props.cwd}
              value={props.cwd}
              onChange={(event) => props.onSelectWorkspace(event.target.value)}
            >
              {(props.workspaces.length > 0
                ? props.workspaces
                : [props.cwd]
              ).map((workspace) => (
                <option key={workspace} value={workspace}>
                  {workspaceName(workspace)}
                </option>
              ))}
            </select>
            <button
              className="sidebar-action"
              type="button"
              dotbot-label="Open workspace"
              title="Open workspace for new session"
              onClick={props.onPickWorkspace}
            >
              <span
                className="codicon codicon-folder-opened"
                dotbot-hidden="true"
              />
            </button>
            <button
              className="sidebar-action"
              type="button"
              dotbot-label="Refresh Explorer"
              title="Refresh Explorer"
              onClick={refresh}
            >
              <span className="codicon codicon-refresh" dotbot-hidden="true" />
            </button>
          </div>
          <div className="explorer-tree" role="tree" dotbot-label="Explorer">
            {error ? (
              <p className="sidebar-error">{error}</p>
            ) : (
              (!loading || visibleEntries.length > 0) &&
              visibleEntries.map((row) => {
                const directory = row.entry.kind === "directory";
                const isExpanded = expanded.has(row.entry.path);
                return (
                  <button
                    key={row.entry.path}
                    className={`explorer-entry ${selectedPath === row.entry.path ? "is-selected" : ""}`}
                    type="button"
                    role="treeitem"
                    dotbot-selected={String(selectedPath === row.entry.path)}
                    dotbot-expanded={directory ? String(isExpanded) : undefined}
                    style={{ paddingLeft: `${8 + row.depth * 16}px` }}
                    onClick={() => {
                      if (directory) toggleDirectory(row.entry.path);
                      else setSelectedPath(row.entry.path);
                    }}
                  >
                    <span
                      className={`codicon ${directory ? (isExpanded ? "codicon-chevron-down" : "codicon-chevron-right") : "codicon-file"}`}
                      dotbot-hidden="true"
                    />
                    <span className="explorer-entry-name">
                      {row.entry.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
