/** One file or directory returned by `readDirectory`. */
export type ExplorerEntry = {
  name: string;
  /** Path relative to the requested workspace root. */
  path: string;
  kind: "file" | "directory";
};
