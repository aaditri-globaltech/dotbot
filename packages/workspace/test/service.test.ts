import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readDirectory, validateDirectory } from "../src/service";

const workspace = mkdtempSync(join(tmpdir(), "aria-workspace-test-"));

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
