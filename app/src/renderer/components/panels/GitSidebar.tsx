import type { GitChange } from "@dotbot/git";
import { createSignal, For, Show } from "solid-js";
import { api } from "../../api";
import { errorMessage } from "../../errors";
import { createGitStatus } from "../../hooks/git-status";
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
  const git = createGitStatus(() => props.projectDir);
  const status = git.status;
  const [message, setMessage] = createSignal("");
  const [error, setError] = createSignal<string>();

  // Refresh after every mutation to keep the sidebar aligned with Git's state.
  const runAction = async (action: () => Promise<void>) => {
    setError(undefined);
    try {
      await action();
      git.refresh();
    } catch (reason) {
      setError(errorMessage(reason));
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
    if (!projectDir || !message().trim()) return;
    void runAction(async () => {
      await api.git.commit(projectDir, message());
      setMessage("");
    });
  };

  const stagedChanges = () =>
    status()?.changes.filter((change) => isStaged(change)) ?? [];
  const unstagedChanges = () =>
    status()?.changes.filter((change) => !isStaged(change)) ?? [];

  const changeList = (changes: GitChange[], staged: boolean) => (
    <For each={changes}>
      {(change) => (
        <div class="group flex min-h-[25px] items-center gap-1.5 py-0.5 pr-1.5 pl-2.5 text-[11px] text-secondary hover:bg-surface-hover">
          <span class="shrink-0 basis-3 text-center font-semibold text-warning">
            {changeLabel(change)[0]}
          </span>
          <span class="min-w-0 truncate" title={change.path}>
            {change.path}
          </span>
          <button
            class={`${ICON_BUTTON_CLASS} ml-auto invisible group-hover:visible focus-visible:visible`}
            type="button"
            label={staged ? `Unstage ${change.path}` : `Stage ${change.path}`}
            title={staged ? "Unstage Changes" : "Stage Changes"}
            onClick={() => (staged ? unstage(change.path) : stage(change.path))}
          >
            <span
              class={`codicon ${staged ? "codicon-remove" : "codicon-add"}`}
              decorative="true"
            />
          </button>
        </div>
      )}
    </For>
  );

  return (
    <div class="min-h-0 flex-1 overflow-auto">
      <Show
        when={props.projectDir}
        fallback={
          <p class="mx-3 my-4.5 text-[11px] leading-normal text-dim">
            Open a project for Git.
          </p>
        }
      >
        <div class="flex min-h-[30px] shrink-0 items-center gap-1.5 border-b border-border px-2.5 text-[11px] text-muted">
          <span class="codicon codicon-git-branch" decorative="true" />
          <span
            class="min-w-0 flex-1 truncate"
            title={status()?.repoRoot ?? props.projectDir}
          >
            {status()?.branch ?? "Git"}
          </span>
          <button
            class={ICON_BUTTON_CLASS}
            type="button"
            label="Refresh Git"
            title="Refresh Git"
            onClick={git.refresh}
          >
            <span class="codicon codicon-refresh" decorative="true" />
          </button>
        </div>

        <Show when={error()}>
          <p class="mx-3 my-4.5 text-[11px] leading-normal text-error">
            {error()}
          </p>
        </Show>
        <Show when={status()?.error}>
          {(failure) => (
            <p class="mx-3 my-4.5 text-[11px] leading-normal text-error">
              {failure()}
            </p>
          )}
        </Show>
        <Show when={status()?.repoRoot && !status()?.error}>
          <div class="flex shrink-0 flex-col gap-1.5 border-b border-border p-2.5">
            <textarea
              value={message()}
              placeholder={`Message (${formatKeybinding(DEFAULT_APP_KEYBINDINGS.commit)} to commit)`}
              rows={2}
              onInput={(event) => setMessage(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (matchesKey(event, DEFAULT_APP_KEYBINDINGS.commit)) {
                  commit();
                }
              }}
            />
            <button
              class="shrink-0 cursor-pointer self-start rounded-sm bg-button px-2.5 py-1 text-[11px] text-white disabled:cursor-default disabled:bg-elevated disabled:text-dim"
              type="button"
              disabled={!message().trim() || stagedChanges().length === 0}
              onClick={commit}
            >
              Commit
            </button>
          </div>

          <section class="border-b border-border">
            <h2 class="flex justify-between p-[7px_10px] text-[10px] font-medium tracking-[0.04em] text-muted uppercase">
              Staged Changes{" "}
              <span class="text-dim">{stagedChanges().length}</span>
            </h2>
            <Show
              when={stagedChanges().length > 0}
              fallback={
                <p class="mx-2.5 mt-1 mb-2.5 text-[11px] text-dim">
                  No staged changes
                </p>
              }
            >
              {changeList(stagedChanges(), true)}
            </Show>
          </section>
          <section class="border-b border-border">
            <h2 class="flex justify-between p-[7px_10px] text-[10px] font-medium tracking-[0.04em] text-muted uppercase">
              Changes <span class="text-dim">{unstagedChanges().length}</span>
            </h2>
            <Show
              when={unstagedChanges().length > 0}
              fallback={
                <p class="mx-2.5 mt-1 mb-2.5 text-[11px] text-dim">
                  No changes
                </p>
              }
            >
              {changeList(unstagedChanges(), false)}
            </Show>
          </section>
        </Show>
      </Show>
    </div>
  );
}
