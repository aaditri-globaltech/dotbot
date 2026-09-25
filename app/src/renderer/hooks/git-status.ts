/** Read the project Git status, refreshed when the project or files change. */

import type { GitStatus } from "@dotbot/git";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { api } from "../api";

export type GitStatusReader = {
  /** Current Git status for one project, or undefined while it loads. */
  status: Accessor<GitStatus | undefined>;
  /** Re-read the status, for example after staging or committing. */
  refresh: () => void;
};

/** Track one project's Git status, re-reading it when its files change. */
export function createGitStatus(
  projectDir: Accessor<string | undefined>,
): GitStatusReader {
  const [status, setStatus] = createSignal<GitStatus>();
  // Directory of the latest effect run, so a slow read for a previous project
  // cannot overwrite the status of the current one.
  let current: string | undefined;

  const read = (dir: string) => {
    void api.git
      .status(dir)
      .then((next) => {
        if (current === dir) setStatus(next);
      })
      .catch((error: unknown) => console.error(error));
  };

  createEffect(() => {
    const dir = projectDir();
    current = dir;
    if (!dir) {
      setStatus(undefined);
      return;
    }

    read(dir);
    // Staging and commits rewrite .git, so read those changes too.
    const unsubscribe = api.files.onChanged((change) => {
      if (change.projectDir === dir) read(dir);
    });
    onCleanup(unsubscribe);
  });

  return {
    status,
    refresh: () => {
      if (current) read(current);
    },
  };
}
