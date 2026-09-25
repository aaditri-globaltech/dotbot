import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  readDirectory,
  validateProjectDir,
  watchDirectory,
} from "../src/service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 3_000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for a file change");
    }
    await sleep(25);
  }
}

const projectDir = mkdtempSync(join(tmpdir(), "dotbot-files-test-"));

beforeAll(() => {
  mkdirSync(join(projectDir, "src", "nested"), { recursive: true });
  mkdirSync(join(projectDir, ".git"), { recursive: true });
  writeFileSync(join(projectDir, "README.md"), "# test");
  writeFileSync(join(projectDir, "src", "index.ts"), "export {};");
});

describe("readDirectory", () => {
  it("sorts directories before files and hides .git", async () => {
    const entries = await readDirectory(projectDir, "");
    expect(entries).toEqual([
      { name: "src", path: "src", kind: "directory" },
      { name: "README.md", path: "README.md", kind: "file" },
    ]);
  });

  it("reads nested directories relative to the project root", async () => {
    const entries = await readDirectory(projectDir, "src");
    expect(entries).toEqual([
      { name: "nested", path: "src/nested", kind: "directory" },
      { name: "index.ts", path: "src/index.ts", kind: "file" },
    ]);
  });

  it("rejects paths outside the project and missing directories", async () => {
    await expect(readDirectory(projectDir, "../")).rejects.toThrow(
      "outside the project",
    );
    await expect(readDirectory(projectDir, "missing")).rejects.toThrow(
      "Project path must be a directory",
    );
    await expect(readDirectory(undefined, "")).rejects.toThrow(
      "Project directory does not exist",
    );
  });
});

describe("validateProjectDir", () => {
  it("resolves existing directories and rejects files", async () => {
    await expect(validateProjectDir(projectDir)).resolves.toBe(projectDir);
    await expect(
      validateProjectDir(join(projectDir, "README.md")),
    ).rejects.toThrow("Project directory does not exist");
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
        "Project directory does not exist",
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
