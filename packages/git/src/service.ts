import { isAbsolute, relative, resolve } from "node:path";
import { validateProjectDir } from "@dotbot/files";
import { parseGitStatus, runGit } from "./cli";
import type { GitStatus } from "./types";

/** Adapt Git's repository status to the renderer's Git model. */
export async function gitStatus(projectDirValue: unknown): Promise<GitStatus> {
  const projectDir = await validateProjectDir(projectDirValue);
  const repoRootResult = await runGit(projectDir, [
    "rev-parse",
    "--show-toplevel",
  ]);
  if (repoRootResult.code !== 0) {
    return {
      projectDir,
      changes: [],
      error:
        repoRootResult.code === -1
          ? "Git is not installed or unavailable."
          : "This project is not a Git repository.",
    };
  }

  const repoRoot = resolve(repoRootResult.stdout.trim());
  const [branchResult, statusResult] = await Promise.all([
    runGit(repoRoot, ["branch", "--show-current"]),
    runGit(repoRoot, [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]),
  ]);
  if (statusResult.code !== 0) {
    return {
      projectDir,
      repoRoot,
      changes: [],
      error: statusResult.stderr.trim() || "Unable to read Git status.",
    };
  }

  return {
    projectDir,
    repoRoot,
    branch: branchResult.stdout.trim() || "HEAD detached",
    changes: parseGitStatus(statusResult.stdout),
  };
}

async function getGitRoot(projectDirValue: unknown): Promise<string> {
  const status = await gitStatus(projectDirValue);
  if (!status.repoRoot) {
    throw new Error(status.error ?? "Git repository not found");
  }
  return status.repoRoot;
}

/** Keep renderer-supplied Git paths relative to the validated repository root. */
function validateGitPath(repoRoot: string, value: unknown): string {
  if (typeof value !== "string" || !value || isAbsolute(value)) {
    throw new Error("Git path is invalid");
  }

  const target = resolve(repoRoot, value);
  const pathFromRoot = relative(repoRoot, target);
  if (
    !pathFromRoot ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error("Git path is outside the repository");
  }
  return value;
}

async function runGitPathAction(
  projectDirValue: unknown,
  pathValue: unknown,
  action: "add" | "reset",
): Promise<void> {
  const repoRoot = await getGitRoot(projectDirValue);
  const path = validateGitPath(repoRoot, pathValue);
  const result = await runGit(repoRoot, [action, "--", path]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `Git ${action} failed`);
  }
}

/** Stage one repository-relative path. */
export function gitStage(
  projectDirValue: unknown,
  pathValue: unknown,
): Promise<void> {
  return runGitPathAction(projectDirValue, pathValue, "add");
}

/** Remove one repository-relative path from the index. */
export function gitUnstage(
  projectDirValue: unknown,
  pathValue: unknown,
): Promise<void> {
  return runGitPathAction(projectDirValue, pathValue, "reset");
}

/** Commit the currently staged changes with a non-empty message. */
export async function gitCommit(
  projectDirValue: unknown,
  messageValue: unknown,
): Promise<void> {
  if (typeof messageValue !== "string" || !messageValue.trim()) {
    throw new Error("Commit message must not be empty");
  }

  const repoRoot = await getGitRoot(projectDirValue);
  const result = await runGit(repoRoot, ["commit", "-m", messageValue.trim()]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "Git commit failed");
  }
}
