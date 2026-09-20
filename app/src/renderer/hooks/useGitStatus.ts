/** Read the project Git status, refreshed when the project or files change. */

import type { GitStatus } from "@dotbot/git";
import { useEffect, useState } from "react";
import { api } from "../api";

/** Current Git status for one project, or undefined while it loads. */
export function useGitStatus(
  projectDir: string | undefined,
): GitStatus | undefined {
  const [status, setStatus] = useState<GitStatus>();

  useEffect(() => {
    if (!projectDir) {
      setStatus(undefined);
      return;
    }

    let cancelled = false;
    const read = () => {
      void api.git
        .status(projectDir)
        .then((next) => {
          if (!cancelled) setStatus(next);
        })
        .catch((error: unknown) => console.error(error));
    };

    read();
    const unsubscribe = api.files.onChanged((change) => {
      // Staging and commits rewrite .git, so read those changes too.
      if (change.projectDir === projectDir) read();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectDir]);

  return status;
}
