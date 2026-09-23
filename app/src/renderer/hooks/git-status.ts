/** Read the project Git status, refreshed when the project or files change. */

import type { GitStatus } from "@dotbot/git";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { api } from "../api";

/** Current Git status for one project, or undefined while it loads. */
export function createGitStatus(
  projectDir: Accessor<string | undefined>,
): Accessor<GitStatus | undefined> {
  const [status, setStatus] = createSignal<GitStatus>();

  createEffect(() => {
    const dir = projectDir();
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    if (!dir) {
      setStatus(undefined);
    } else {
      const read = () => {
        void api.git
          .status(dir)
          .then((next) => {
            if (!cancelled) setStatus(next);
          })
          .catch((error: unknown) => console.error(error));
      };

      read();
      unsubscribe = api.files.onChanged((change) => {
        // Staging and commits rewrite .git, so read those changes too.
        if (change.projectDir === dir) read();
      });
    }

    onCleanup(() => {
      cancelled = true;
      unsubscribe?.();
    });
  });

  return status;
}
