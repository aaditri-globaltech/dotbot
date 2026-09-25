import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it } from "vitest";
import { TrustManager } from "../src/trust";

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("TrustManager", () => {
  let agentDir: string;
  let manager: TrustManager;

  beforeEach(() => {
    agentDir = tempDir("dotbot-trust-manager-");
    manager = new TrustManager(agentDir);
  });

  it("returns no decisions when trust.json is missing", () => {
    expect(manager.list()).toEqual([]);
  });

  it("lists saved decisions sorted by path", () => {
    new ProjectTrustStore(agentDir).setMany([
      { path: "/b", decision: true },
      { path: "/a", decision: false },
    ]);

    expect(manager.list()).toEqual([
      { path: "/a", decision: false },
      { path: "/b", decision: true },
    ]);
  });

  it("rejects a malformed trust file with a descriptive error", () => {
    writeFileSync(join(agentDir, "trust.json"), "{ not json", "utf-8");

    expect(() => manager.list()).toThrow(/Invalid trust store/);
  });

  it("rejects a trust file with non-boolean values", () => {
    writeFileSync(
      join(agentDir, "trust.json"),
      JSON.stringify({ "/a": "yes" }),
      "utf-8",
    );

    expect(() => manager.list()).toThrow(/must be true or false/);
  });

  it("revokes one decision and leaves the rest intact", () => {
    new ProjectTrustStore(agentDir).setMany([
      { path: "/a", decision: true },
      { path: "/b", decision: false },
    ]);

    manager.revoke("/a");

    expect(manager.list()).toEqual([{ path: "/b", decision: false }]);
  });

  it("defaults to ask and persists a new default", async () => {
    expect(manager.getDefault()).toBe("ask");

    await manager.setDefault("never");

    expect(new TrustManager(agentDir).getDefault()).toBe("never");
  });

  it("rejects an invalid default", async () => {
    await expect(manager.setDefault("sometimes")).rejects.toThrow(
      "Project trust default is invalid",
    );
  });

  it("rejects when the default cannot be persisted", async () => {
    writeFileSync(join(agentDir, "settings.json"), "{ not json", "utf-8");

    await expect(manager.setDefault("never")).rejects.toThrow(
      "Project trust default was not saved",
    );
  });

  it("peeks at saved decisions, inheritance, and the global default", async () => {
    const projectDir = tempDir("dotbot-trust-project-");
    const childDir = join(projectDir, "child");
    mkdirSync(childDir, { recursive: true });

    expect(manager.peek(childDir)).toBe(false);

    await manager.setDefault("always");
    expect(manager.peek(childDir)).toBe(true);

    new ProjectTrustStore(agentDir).set(projectDir, true);
    expect(manager.peek(childDir)).toBe(true);

    new ProjectTrustStore(agentDir).set(projectDir, false);
    expect(manager.peek(childDir)).toBe(false);
  });
});
