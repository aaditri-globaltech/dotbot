import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
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
