import { spawn } from "node:child_process";
import type { GitChange } from "./types";

/** Result of one direct Git subprocess invocation. */
export type GitCommandResult = {
  /** Exit code, or `-1` when Git could not be started. */
  code: number;
  stdout: string;
  stderr: string;
};

/** Run Git without a shell so paths cannot become commands. */
export function runGit(dir: string, args: string[]): Promise<GitCommandResult> {
  const command = process.platform === "win32" ? "git.exe" : "git";

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: -1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** Parse Git's NUL-delimited porcelain v1 status format. */
export function parseGitStatus(output: string): GitChange[] {
  const changes: GitChange[] = [];
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 3) continue;

    const indexStatus = record[0] ?? " ";
    const worktreeStatus = record[1] ?? " ";
    const path = record.slice(3);
    if (!path) continue;

    // Rename/copy records include the old path as the following NUL record.
    if (indexStatus === "R" || indexStatus === "C") index += 1;

    changes.push({ path, indexStatus, worktreeStatus });
  }

  return changes;
}
