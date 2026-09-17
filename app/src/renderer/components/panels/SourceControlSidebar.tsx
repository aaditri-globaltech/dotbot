import type { GitChange, GitStatus } from "@dotbot/source-control";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { errorMessage } from "../../errors";
import {
  DEFAULT_APP_KEYBINDINGS,
  formatKeybinding,
  matchesKey,
} from "../../keybindings";

type SourceControlSidebarProps = {
  cwd?: string;
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
export function SourceControlSidebar(props: SourceControlSidebarProps) {
  const [status, setStatus] = useState<GitStatus>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const requestIdRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const loadStatus = useCallback(
    async (cwd: string) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(undefined);
      try {
        const next = await api.workspace.gitStatus(cwd);
        if (props.cwd !== cwd || requestId !== requestIdRef.current) return;
        setStatus(next);
      } catch (reason) {
        if (props.cwd === cwd && requestId === requestIdRef.current) {
          setStatus(undefined);
          setError(errorMessage(reason));
        }
      } finally {
        // Only the latest request may clear the loading state.
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [props.cwd],
  );

  useEffect(() => {
    setStatus(undefined);
    setError(undefined);
    if (props.cwd) void loadStatus(props.cwd);
  }, [props.cwd, loadStatus]);

  // File changes make Git status stale; debounce because edits arrive in bursts.
  useEffect(() => {
    const cwd = props.cwd;
    if (!cwd) return;
    const unsubscribe = api.workspace.onChanged((change) => {
      if (change.cwd !== cwd) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = undefined;
        void loadStatus(cwd);
      }, 500);
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [props.cwd, loadStatus]);

  const refresh = () => {
    if (props.cwd) void loadStatus(props.cwd);
  };

  // Refresh after every mutation to keep the sidebar aligned with Git's state.
  const runAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(undefined);
    try {
      await action();
      if (props.cwd) await loadStatus(props.cwd);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };

  const stage = (path: string) => {
    const cwd = props.cwd;
    if (!cwd) return;
    void runAction(() => api.workspace.gitStage(cwd, path));
  };

  const unstage = (path: string) => {
    const cwd = props.cwd;
    if (!cwd) return;
    void runAction(() => api.workspace.gitUnstage(cwd, path));
  };

  const commit = () => {
    const cwd = props.cwd;
    if (!cwd || !message.trim()) return;
    void runAction(async () => {
      await api.workspace.gitCommit(cwd, message);
      setMessage("");
    });
  };

  const stagedChanges =
    status?.changes.filter((change) => isStaged(change)) ?? [];
  const unstagedChanges =
    status?.changes.filter((change) => !isStaged(change)) ?? [];

  const changeList = (changes: GitChange[], staged: boolean) =>
    changes.map((change) => (
      <div key={change.path} className="scm-change">
        <span className="scm-change-kind">{changeLabel(change)[0]}</span>
        <span className="scm-change-name" title={change.path}>
          {change.path}
        </span>
        <button
          className="sidebar-action scm-change-action"
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
    <div className="scm-sidebar">
      {!props.cwd ? (
        <p className="sidebar-empty">Open a workspace for source control.</p>
      ) : (
        <>
          <div className="scm-toolbar">
            <span className="codicon codicon-git-branch" dotbot-hidden="true" />
            <span className="scm-branch" title={status?.root ?? props.cwd}>
              {status?.branch ?? "Git"}
            </span>
            <button
              className="sidebar-action"
              type="button"
              dotbot-label="Refresh Source Control"
              title="Refresh Source Control"
              onClick={refresh}
            >
              <span className="codicon codicon-refresh" dotbot-hidden="true" />
            </button>
          </div>

          {error && <p className="sidebar-error">{error}</p>}
          {status?.error && <p className="sidebar-error">{status.error}</p>}
          {status?.root && !status.error && (
            <>
              <div className="scm-commit-box">
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
                  className="scm-commit-button"
                  type="button"
                  disabled={
                    loading || !message.trim() || stagedChanges.length === 0
                  }
                  onClick={commit}
                >
                  Commit
                </button>
              </div>

              <section className="scm-group">
                <h2>
                  Staged Changes <span>{stagedChanges.length}</span>
                </h2>
                {stagedChanges.length > 0 ? (
                  changeList(stagedChanges, true)
                ) : (
                  <p className="scm-empty">No staged changes</p>
                )}
              </section>
              <section className="scm-group">
                <h2>
                  Changes <span>{unstagedChanges.length}</span>
                </h2>
                {unstagedChanges.length > 0 ? (
                  changeList(unstagedChanges, false)
                ) : (
                  <p className="scm-empty">No changes</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
