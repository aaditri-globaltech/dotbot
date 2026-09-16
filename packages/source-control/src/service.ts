import { isAbsolute, relative, resolve } from "node:path";
import { validateDirectory } from "@dotbot/workspace";
import { parseGitStatus, runGit } from "./git";
import type { GitStatus } from "./types";

/** Adapt Git's repository status to the renderer's Source Control model. */
export async function gitStatus(cwdValue: unknown): Promise<GitStatus> {
  const cwd = await validateDirectory(cwdValue);
  const rootResult = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (rootResult.code !== 0) {
    return {
      cwd,
      changes: [],
      error:
        rootResult.code === -1
          ? "Git is not installed or unavailable."
          : "This workspace is not a Git repository.",
    };
  }

  const root = resolve(rootResult.stdout.trim());
  const [branchResult, statusResult] = await Promise.all([
    runGit(root, ["branch", "--show-current"]),
    runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
  ]);
  if (statusResult.code !== 0) {
    return {
      cwd,
      root,
      changes: [],
      error: statusResult.stderr.trim() || "Unable to read Git status.",
    };
  }

  return {
    cwd,
    root,
    branch: branchResult.stdout.trim() || "HEAD detached",
    changes: parseGitStatus(statusResult.stdout),
  };
}

async function getGitRoot(cwdValue: unknown): Promise<string> {
  const status = await gitStatus(cwdValue);
  if (!status.root) throw new Error(status.error ?? "Git repository not found");
  return status.root;
}

/** Keep renderer-supplied Git paths relative to the validated repository root. */
function validateGitPath(root: string, value: unknown): string {
  if (typeof value !== "string" || !value || isAbsolute(value)) {
    throw new Error("Git path is invalid");
  }

  const target = resolve(root, value);
  const pathFromRoot = relative(root, target);
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
  cwdValue: unknown,
  pathValue: unknown,
  action: "add" | "reset",
): Promise<void> {
  const root = await getGitRoot(cwdValue);
  const path = validateGitPath(root, pathValue);
  const result = await runGit(root, [action, "--", path]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `Git ${action} failed`);
  }
}

/** Stage one repository-relative path. */
export function gitStage(cwdValue: unknown, pathValue: unknown): Promise<void> {
  return runGitPathAction(cwdValue, pathValue, "add");
}

/** Remove one repository-relative path from the index. */
export function gitUnstage(
  cwdValue: unknown,
  pathValue: unknown,
): Promise<void> {
  return runGitPathAction(cwdValue, pathValue, "reset");
}

/** Commit the currently staged changes with a non-empty message. */
export async function gitCommit(
  cwdValue: unknown,
  messageValue: unknown,
): Promise<void> {
  if (typeof messageValue !== "string" || !messageValue.trim()) {
    throw new Error("Commit message must not be empty");
  }

  const root = await getGitRoot(cwdValue);
  const result = await runGit(root, ["commit", "-m", messageValue.trim()]);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "Git commit failed");
  }
}
