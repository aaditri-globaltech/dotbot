/**
 * Project trust data for the desktop app.
 *
 * Wraps Pi's trust store and global settings so the renderer can list saved
 * decisions and change the global fallback without reaching into the SDK.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type DefaultProjectTrust,
  getAgentDir,
  ProjectTrustStore,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { TrustDecisionEntry } from "./types";

/** Trust decisions and global fallback stored in the agent directory. */
export class TrustManager {
  /** Pi agent directory holding trust.json and settings.json. */
  readonly agentDir: string;

  constructor(agentDir: string = getAgentDir()) {
    this.agentDir = agentDir;
  }

  /** Saved trust decisions, sorted by path. */
  list(): TrustDecisionEntry[] {
    const trustPath = join(this.agentDir, "trust.json");
    let raw: string;
    try {
      raw = readFileSync(trustPath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid trust store ${trustPath}: not valid JSON`);
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(`Invalid trust store ${trustPath}: expected an object`);
    }

    const entries: TrustDecisionEntry[] = [];
    for (const [path, decision] of Object.entries(parsed)) {
      if (decision === true || decision === false) {
        entries.push({ path, decision });
        continue;
      }
      if (decision !== null) {
        throw new Error(
          `Invalid trust store ${trustPath}: value for ${JSON.stringify(path)} must be true or false`,
        );
      }
    }
    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Remove one saved decision; the next session asks again. */
  revoke(path: string): void {
    new ProjectTrustStore(this.agentDir).set(path, null);
  }

  /** Global fallback for projects without a saved decision. */
  getDefault(): DefaultProjectTrust {
    return this.settings().getDefaultProjectTrust();
  }

  /** Change the global fallback. */
  async setDefault(value: unknown): Promise<void> {
    if (value !== "ask" && value !== "always" && value !== "never") {
      throw new Error("Project trust default is invalid");
    }
    const settings = this.settings();
    settings.setDefaultProjectTrust(value);
    await settings.flush();
    const [failure] = settings.drainErrors();
    if (failure || this.getDefault() !== value) {
      throw new Error(
        failure
          ? `Project trust default was not saved: ${failure.error.message}`
          : "Project trust default was not saved",
      );
    }
  }

  /** Non-prompting read for callers that cannot await the trust dialog. */
  peek(cwd: string): boolean {
    const saved = new ProjectTrustStore(this.agentDir).get(cwd);
    if (saved !== null) return saved;
    return this.getDefault() === "always";
  }

  // The project scope points at the agent directory so project settings can
  // never shadow the global default, which is the only value read here.
  private settings(): SettingsManager {
    return SettingsManager.create(this.agentDir, this.agentDir);
  }
}
