import type { GitChange, GitStatus } from "@dotbot/git";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { errorMessage } from "../../errors";
import {
  DEFAULT_APP_KEYBINDINGS,
  formatKeybinding,
  matchesKey,
} from "../../keybindings";
import { ICON_BUTTON_CLASS } from "./panel-classes";

type GitSidebarProps = {
  projectDir?: string;
};

function changeLabel(change: GitChange) {
  const code =
    change.indexStatus !== " " && change.indexStatus !== "?"
      ? change.indexStatus
      : change.worktreeStatus;
  return (
    {
      A: "Added",
      C: "Copied",
      D: "Deleted",
      M: "Modified",
      R: "Renamed",
      U: "Unmerged",
      "?": "Untracked",
    }[code] ?? "Changed"
  );
}

// Git's first porcelain column describes the index; the second is the worktree.
function isStaged(change: GitChange) {
  return change.indexStatus !== " " && change.indexStatus !== "?";
}

/** Render Git status, staging actions, and the commit form. */
export function GitSidebar(props: GitSidebarProps) {
  const [status, setStatus] = useState<GitStatus>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const requestIdRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const loadStatus = useCallback(
    async (projectDir: string) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(undefined);
      try {
        const next = await api.git.status(projectDir);
        if (
          props.projectDir !== projectDir ||
          requestId !== requestIdRef.current
        )
          return;
        setStatus(next);
      } catch (reason) {
        if (
          props.projectDir === projectDir &&
          requestId === requestIdRef.current
        ) {
          setStatus(undefined);
          setError(errorMessage(reason));
        }
      } finally {
        // Only the latest request may clear the loading state.
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [props.projectDir],
  );

  useEffect(() => {
    setStatus(undefined);
    setError(undefined);
    if (props.projectDir) void loadStatus(props.projectDir);
  }, [props.projectDir, loadStatus]);

  // File changes make Git status stale; debounce because edits arrive in bursts.
  useEffect(() => {
    const projectDir = props.projectDir;
    if (!projectDir) return;
    const unsubscribe = api.files.onChanged((change) => {
      if (change.projectDir !== projectDir) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = undefined;
        void loadStatus(projectDir);
      }, 500);
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [props.projectDir, loadStatus]);

  const refresh = () => {
    if (props.projectDir) void loadStatus(props.projectDir);
  };

  // Refresh after every mutation to keep the sidebar aligned with Git's state.
  const runAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(undefined);
    try {
      await action();
      if (props.projectDir) await loadStatus(props.projectDir);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const stage = (path: string) => {
    const projectDir = props.projectDir;
    if (!projectDir) return;
    void runAction(() => api.git.stage(projectDir, path));
  };

  const unstage = (path: string) => {
    const projectDir = props.projectDir;
    if (!projectDir) return;
    void runAction(() => api.git.unstage(projectDir, path));
  };

  const commit = () => {
    const projectDir = props.projectDir;
    if (!projectDir || !message.trim()) return;
    void runAction(async () => {
      await api.git.commit(projectDir, message);
      setMessage("");
    });
  };

  const stagedChanges =
    status?.changes.filter((change) => isStaged(change)) ?? [];
  const unstagedChanges =
    status?.changes.filter((change) => !isStaged(change)) ?? [];

  const changeList = (changes: GitChange[], staged: boolean) =>
    changes.map((change) => (
      <div
        key={change.path}
        className="group flex min-h-[25px] items-center gap-1.5 py-0.5 pr-1.5 pl-2.5 text-[11px] text-secondary hover:bg-surface-hover"
      >
        <span className="shrink-0 basis-3 text-center font-semibold text-warning">
          {changeLabel(change)[0]}
        </span>
        <span className="min-w-0 truncate" title={change.path}>
          {change.path}
        </span>
        <button
          className={`${ICON_BUTTON_CLASS} ml-auto invisible group-hover:visible focus-visible:visible`}
          type="button"
          dotbot-label={
            staged ? `Unstage ${change.path}` : `Stage ${change.path}`
          }
          title={staged ? "Unstage Changes" : "Stage Changes"}
          onClick={() => (staged ? unstage(change.path) : stage(change.path))}
        >
          <span
            className={`codicon ${staged ? "codicon-remove" : "codicon-add"}`}
            dotbot-hidden="true"
          />
        </button>
      </div>
    ));

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {!props.projectDir ? (
        <p className="mx-3 my-4.5 text-[11px] leading-normal text-dim">
          Open a project for Git.
        </p>
      ) : (
        <>
          <div className="flex min-h-[30px] shrink-0 items-center gap-1.5 border-b border-border px-2.5 text-[11px] text-muted">
            <span className="codicon codicon-git-branch" dotbot-hidden="true" />
            <span
              className="min-w-0 flex-1 truncate"
              title={status?.repoRoot ?? props.projectDir}
            >
              {status?.branch ?? "Git"}
            </span>
            <button
              className={ICON_BUTTON_CLASS}
              type="button"
              dotbot-label="Refresh Git"
              title="Refresh Git"
              onClick={refresh}
            >
              <span className="codicon codicon-refresh" dotbot-hidden="true" />
            </button>
          </div>

          {error && (
            <p className="mx-3 my-4.5 text-[11px] leading-normal text-error">
              {error}
            </p>
          )}
          {status?.error && (
            <p className="mx-3 my-4.5 text-[11px] leading-normal text-error">
              {status.error}
            </p>
          )}
          {status?.repoRoot && !status.error && (
            <>
              <div className="flex shrink-0 flex-col gap-1.5 border-b border-border p-2.5">
                <textarea
                  value={message}
                  placeholder={`Message (${formatKeybinding(DEFAULT_APP_KEYBINDINGS.commit)} to commit)`}
                  rows={2}
                  disabled={loading}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      matchesKey(
                        event.nativeEvent,
                        DEFAULT_APP_KEYBINDINGS.commit,
                      )
                    ) {
                      commit();
                    }
                  }}
                />
                <button
                  className="shrink-0 cursor-pointer self-start rounded-sm bg-button px-2.5 py-1 text-[11px] text-white disabled:cursor-default disabled:bg-elevated disabled:text-dim"
                  type="button"
                  disabled={
                    loading || !message.trim() || stagedChanges.length === 0
                  }
                  onClick={commit}
                >
                  Commit
                </button>
              </div>

              <section className="border-b border-border">
                <h2 className="flex justify-between p-[7px_10px] text-[10px] font-medium tracking-[0.04em] text-muted uppercase">
                  Staged Changes{" "}
                  <span className="text-dim">{stagedChanges.length}</span>
                </h2>
                {stagedChanges.length > 0 ? (
                  changeList(stagedChanges, true)
                ) : (
                  <p className="mx-2.5 mt-1 mb-2.5 text-[11px] text-dim">
                    No staged changes
                  </p>
                )}
              </section>
              <section className="border-b border-border">
                <h2 className="flex justify-between p-[7px_10px] text-[10px] font-medium tracking-[0.04em] text-muted uppercase">
                  Changes{" "}
                  <span className="text-dim">{unstagedChanges.length}</span>
                </h2>
                {unstagedChanges.length > 0 ? (
                  changeList(unstagedChanges, false)
                ) : (
                  <p className="mx-2.5 mt-1 mb-2.5 text-[11px] text-dim">
                    No changes
                  </p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
