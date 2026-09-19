/** Read the workspace Git status, refreshed when the workspace or files change. */

import type { GitStatus } from "@dotbot/source-control";
import { useEffect, useState } from "react";
import { api } from "../api";

/** Current Git status for one workspace, or undefined while it loads. */
export function useGitStatus(cwd: string | undefined): GitStatus | undefined {
  const [status, setStatus] = useState<GitStatus>();

  useEffect(() => {
    if (!cwd) {
      setStatus(undefined);
      return;
    }

    let cancelled = false;
    const read = () => {
      void api.workspace
        .gitStatus(cwd)
        .then((next) => {
          if (!cancelled) setStatus(next);
        })
        .catch((error: unknown) => console.error(error));
    };

    read();
    const unsubscribe = api.workspace.onChanged((change) => {
      // Staging and commits rewrite .git, so read those changes too.
      if (change.cwd === cwd) read();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [cwd]);

  return status;
}
