import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import watcher from "@parcel/watcher";
import type { ExplorerEntry } from "./types";

/** Resolve a workspace directory or throw a user-facing error. */
export async function validateDirectory(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Workspace must be a directory");
  }
  const cwd = resolve(value);
  const info = await stat(cwd).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error("Workspace must be a directory");
  return cwd;
}

/** Read one directory, returning paths relative to the workspace root. */
export async function readDirectory(
  cwdValue: unknown,
  relativePathValue: unknown,
): Promise<ExplorerEntry[]> {
  const root = await validateDirectory(cwdValue);
  const relativePath =
    typeof relativePathValue === "string" ? relativePathValue : "";
  const target = resolve(root, relativePath);
  const pathFromRoot = relative(root, target);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    throw new Error("Workspace path is outside the workspace");
  }

  const info = await stat(target).catch(() => undefined);
  if (!info?.isDirectory()) {
    throw new Error("Workspace path must be a directory");
  }

  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.name !== ".git")
    .map(
      (entry): ExplorerEntry => ({
        name: entry.name,
        path: relative(root, join(target, entry.name)),
        kind: entry.isDirectory() ? "directory" : "file",
      }),
    )
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Paths that never need watching; mirrors VS Code's default watcher excludes. */
const WATCH_IGNORES = [
  "**/.git/objects/**",
  "**/.git/subtree-cache/**",
  "**/.hg/store/**",
];

/** Receives normalized, directory-relative paths changed on disk. */
export type WatchDirectoryListener = (paths: string[]) => void;

function normalizeChange(cwd: string, path: string): string {
  return relative(cwd, path).split(sep).join("/");
}

/**
 * Watch a directory recursively and forward the watcher's change batches.
 * Returns a function that stops watching.
 */
export async function watchDirectory(
  cwdValue: unknown,
  listener: WatchDirectoryListener,
  onError?: (error: unknown) => void,
): Promise<() => Promise<void>> {
  const cwd = await validateDirectory(cwdValue);
  const subscription = await watcher.subscribe(
    cwd,
    (error, events) => {
      if (error) {
        onError?.(error);
        return;
      }
      listener(events.map((event) => normalizeChange(cwd, event.path)));
    },
    { ignore: WATCH_IGNORES },
  );

  return () => subscription.unsubscribe();
}
