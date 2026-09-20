import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(import.meta.dirname, "..");

function channels(source: string, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const match of source.matchAll(pattern)) found.add(match[1]);
  return found;
}

function missing(from: Set<string>, has: Set<string>): string[] {
  return [...from].filter((channel) => !has.has(channel));
}

describe("IPC channels", () => {
  const preload = readFileSync(
    join(appRoot, "src/preload/preload.ts"),
    "utf-8",
  );
  const main = readFileSync(join(appRoot, "src/main/main.ts"), "utf-8");

  it("answers every invoke with a handler", () => {
    const invoked = channels(preload, /ipcRenderer\.invoke\(\s*"([^"]+)"/g);
    const handled = channels(main, /ipcMain\.handle\(\s*"([^"]+)"/g);
    expect(missing(invoked, handled)).toEqual([]);
  });

  it("answers every send with a listener", () => {
    const sent = channels(preload, /ipcRenderer\.send\(\s*"([^"]+)"/g);
    const listened = channels(main, /ipcMain\.on\(\s*"([^"]+)"/g);
    expect(missing(sent, listened)).toEqual([]);
  });
});
