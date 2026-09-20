import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import watcher from "@parcel/watcher";
import type { FileEntry } from "./types";

/** Resolve a project directory or throw a user-facing error. */
export async function validateProjectDir(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Project directory does not exist");
  }
  const projectDir = resolve(value);
  const info = await stat(projectDir).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error("Project directory does not exist");
  return projectDir;
}

/** Read one directory, returning paths relative to the project directory. */
export async function readDirectory(
  projectDirValue: unknown,
  relativePathValue: unknown,
): Promise<FileEntry[]> {
  const projectDir = await validateProjectDir(projectDirValue);
  const relativePath =
    typeof relativePathValue === "string" ? relativePathValue : "";
  const target = resolve(projectDir, relativePath);
  const pathFromProject = relative(projectDir, target);
  if (pathFromProject.startsWith("..") || isAbsolute(pathFromProject)) {
    throw new Error("Project path is outside the project");
  }

  const info = await stat(target).catch(() => undefined);
  if (!info?.isDirectory()) {
    throw new Error("Project path must be a directory");
  }

  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.name !== ".git")
    .map(
      (entry): FileEntry => ({
        name: entry.name,
        path: relative(projectDir, join(target, entry.name)),
        kind: entry.isDirectory() ? "directory" : "file",
      }),
    )
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Receives normalized, directory-relative paths changed on disk. */
export type WatchDirectoryListener = (paths: string[]) => void;

function normalizeChange(projectDir: string, path: string): string {
  return relative(projectDir, path).split(sep).join("/");
}

/**
 * Watch a directory recursively and forward the watcher's change batches.
 * Returns a function that stops watching.
 */
export async function watchDirectory(
  projectDirValue: unknown,
  listener: WatchDirectoryListener,
  onError?: (error: unknown) => void,
): Promise<() => Promise<void>> {
  const projectDir = await validateProjectDir(projectDirValue);
  const subscription = await watcher.subscribe(projectDir, (error, events) => {
    if (error) {
      onError?.(error);
      return;
    }
    listener(events.map((event) => normalizeChange(projectDir, event.path)));
  });

  return () => subscription.unsubscribe();
}
