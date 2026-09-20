/** Git status letters and directory dots shown in the file tree. */

import type { GitStatus } from "@dotbot/git";

/** Letters shown on the right of a changed file, keyed by porcelain code. */
const LETTERS: Record<string, string> = {
  "?": "U",
  M: "M",
  A: "A",
  D: "D",
  R: "R",
  C: "C",
  T: "T",
};

/** Status markers for one project, both keyed by relative path. */
type GitMarkers = {
  /** One letter per changed file. */
  files: Map<string, string>;
  /** Directories holding at least one change. */
  directories: Set<string>;
};

function letterFor(indexStatus: string, worktreeStatus: string): string {
  // Untracked files arrive as "??"; everything else reports its own letter.
  const code = [indexStatus, worktreeStatus].find(
    (column) => column !== " " && column !== "",
  );
  if (!code) return "M";
  return LETTERS[code] ?? "M";
}

/** Read the change markers for a project status, ignoring failed reads. */
export function gitMarkers(status?: GitStatus): GitMarkers {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  if (!status || status.error) return { files, directories };

  for (const change of status.changes) {
    files.set(
      change.path,
      letterFor(change.indexStatus, change.worktreeStatus),
    );

    // Every ancestor directory aggregates the change as a dot.
    const segments = change.path.split("/");
    for (let depth = 1; depth < segments.length; depth += 1) {
      directories.add(segments.slice(0, depth).join("/"));
    }
  }

  return { files, directories };
}
