import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  readDirectory,
  validateDirectory,
  watchDirectory,
} from "../src/service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 3_000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for a workspace change");
    }
    await sleep(25);
  }
}

const workspace = mkdtempSync(join(tmpdir(), "dotbot-workspace-test-"));

beforeAll(() => {
  mkdirSync(join(workspace, "src", "nested"), { recursive: true });
  mkdirSync(join(workspace, ".git"), { recursive: true });
  writeFileSync(join(workspace, "README.md"), "# test");
  writeFileSync(join(workspace, "src", "index.ts"), "export {};");
});

describe("readDirectory", () => {
  it("sorts directories before files and hides .git", async () => {
    const entries = await readDirectory(workspace, "");
    expect(entries).toEqual([
      { name: "src", path: "src", kind: "directory" },
      { name: "README.md", path: "README.md", kind: "file" },
    ]);
  });

  it("reads nested directories relative to the workspace root", async () => {
    const entries = await readDirectory(workspace, "src");
    expect(entries).toEqual([
      { name: "nested", path: "src/nested", kind: "directory" },
      { name: "index.ts", path: "src/index.ts", kind: "file" },
    ]);
  });

  it("rejects paths outside the workspace and missing directories", async () => {
    await expect(readDirectory(workspace, "../")).rejects.toThrow(
      "outside the workspace",
    );
    await expect(readDirectory(workspace, "missing")).rejects.toThrow(
      "Workspace path must be a directory",
    );
    await expect(readDirectory(undefined, "")).rejects.toThrow(
      "Workspace must be a directory",
    );
  });
});

describe("validateDirectory", () => {
  it("resolves existing directories and rejects files", async () => {
    await expect(validateDirectory(workspace)).resolves.toBe(workspace);
    await expect(
      validateDirectory(join(workspace, "README.md")),
    ).rejects.toThrow("Workspace must be a directory");
  });
});

describe("watchDirectory", () => {
  it("reports nested changes with relative paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dotbot-watch-"));
    mkdirSync(join(dir, "sub"));
    const changes: string[][] = [];
    const close = await watchDirectory(dir, (paths) => changes.push(paths));
    try {
      writeFileSync(join(dir, "sub", "a.txt"), "x");
      await waitFor(() => changes.some((paths) => paths.includes("sub/a.txt")));
    } finally {
      await close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports every changed file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dotbot-watch-"));
    const changes: string[][] = [];
    const close = await watchDirectory(dir, (paths) => changes.push(paths));
    try {
      writeFileSync(join(dir, "a.txt"), "x");
      writeFileSync(join(dir, "b.txt"), "x");
      await waitFor(() => {
        const reported = new Set(changes.flat());
        return reported.has("a.txt") && reported.has("b.txt");
      });
    } finally {
      await close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects paths that are not directories", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dotbot-watch-"));
    const file = join(dir, "file.txt");
    writeFileSync(file, "x");
    try {
      await expect(watchDirectory(file, () => {})).rejects.toThrow(
        "Workspace must be a directory",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops reporting after close", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dotbot-watch-"));
    const changes: string[][] = [];
    const close = await watchDirectory(dir, (paths) => changes.push(paths));
    await close();
    writeFileSync(join(dir, "late.txt"), "x");
    await sleep(600);
    expect(changes).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
