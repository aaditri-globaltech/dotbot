import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseGitStatus, runGit } from "../src/git";
import { gitCommit, gitStage, gitStatus, gitUnstage } from "../src/service";

describe("parseGitStatus", () => {
  it("parses NUL-delimited porcelain entries and skips rename sources", () => {
    expect(
      parseGitStatus("?? new.txt\0 M src/a.ts\0R  new.ts\0old.ts\0"),
    ).toEqual([
      { path: "new.txt", indexStatus: "?", worktreeStatus: "?" },
      { path: "src/a.ts", indexStatus: " ", worktreeStatus: "M" },
      { path: "new.ts", indexStatus: "R", worktreeStatus: " " },
    ]);
  });

  it("ignores malformed records", () => {
    expect(parseGitStatus("\0x\0")).toEqual([]);
  });
});

const gitCheck = await runGit(process.cwd(), ["--version"]);
const gitAvailable = gitCheck.code === 0;

describe.skipIf(!gitAvailable)("source control", () => {
  const repository = mkdtempSync(join(tmpdir(), "dotbot-git-test-"));

  beforeAll(async () => {
    await runGit(repository, ["init"]);
    await runGit(repository, ["config", "user.name", "Dotbot Test"]);
    await runGit(repository, ["config", "user.email", "test@dotbot.invalid"]);
    writeFileSync(join(repository, "untracked.txt"), "one\n");
  });

  it("reports branch and untracked changes", async () => {
    const status = await gitStatus(repository);
    expect(status.error).toBeUndefined();
    expect(status.root).toBeTruthy();
    expect(status.branch).toBeTruthy();
    expect(status.changes).toContainEqual({
      path: "untracked.txt",
      indexStatus: "?",
      worktreeStatus: "?",
    });
  });

  it("stages, commits, and restores paths", async () => {
    await gitStage(repository, "untracked.txt");
    let status = await gitStatus(repository);
    expect(status.changes).toEqual([
      { path: "untracked.txt", indexStatus: "A", worktreeStatus: " " },
    ]);

    await gitCommit(repository, "add untracked");
    status = await gitStatus(repository);
    expect(status.changes).toEqual([]);

    writeFileSync(join(repository, "untracked.txt"), "two\n");
    await gitStage(repository, "untracked.txt");
    await gitUnstage(repository, "untracked.txt");
    status = await gitStatus(repository);
    expect(status.changes).toEqual([
      { path: "untracked.txt", indexStatus: " ", worktreeStatus: "M" },
    ]);
  });

  it("rejects invalid paths and empty commit messages", async () => {
    await expect(gitStage(repository, "../outside")).rejects.toThrow(
      "Git path is outside the repository",
    );
    await expect(gitCommit(repository, "  ")).rejects.toThrow(
      "Commit message must not be empty",
    );
  });
});
