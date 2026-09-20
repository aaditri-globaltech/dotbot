/** One file or directory returned by `readDirectory`. */
export type FileEntry = {
  name: string;
  /** Path relative to the requested project directory. */
  path: string;
  kind: "file" | "directory";
};
