/**
 * The renderer is a browser context. Runtime imports of Node-side packages
 * drag Node-only dependencies into the Vite bundle, which breaks the app with a
 * white screen. The agent-core root re-exports the Pi SDK and is banned; its
 * `/text` and `/types` subpaths are dependency-free and safe. Runtime values
 * the renderer needs must cross the preload bridge instead.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = join(import.meta.dirname, "../src/renderer");

function isNodeSide(specifier: string): boolean {
  // The package root re-exports the Pi SDK; the other subpaths are safe.
  if (specifier === "@dotbot/agent-core") return true;
  return (
    specifier.startsWith("@dotbot/files") ||
    specifier.startsWith("@dotbot/git") ||
    specifier.startsWith("@earendil-works/") ||
    specifier.startsWith("node:")
  );
}

function sourceFiles(): string[] {
  return readdirSync(rendererRoot, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .map((entry) => join(rendererRoot, entry));
}

/** Import specifiers that pull runtime values, excluding `import type`. */
function valueImports(source: string): string[] {
  const offenders: string[] = [];
  const imports = source.matchAll(
    /import\s+(?!type\b)([\s\S]*?)from\s+"([^"]+)"/g,
  );
  for (const [, clause, specifier] of imports) {
    if (!isNodeSide(specifier)) continue;
    const braces = clause.match(/\{([\s\S]*)\}/);
    const hasValue = braces
      ? braces[1]
          .split(",")
          .some((part) => part.trim() && !part.trim().startsWith("type "))
      : clause.trim().length > 0;
    if (hasValue) offenders.push(specifier);
  }
  return offenders;
}

describe("renderer imports", () => {
  it("only type-imports node-side packages", () => {
    const offenses = sourceFiles().flatMap((file) =>
      valueImports(readFileSync(file, "utf-8")).map(
        (specifier) => `${file.slice(rendererRoot.length + 1)}: ${specifier}`,
      ),
    );

    expect(offenses).toEqual([]);
  });
});
