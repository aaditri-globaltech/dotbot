/**
 * Branding applied to the installed Pi runtime package.
 *
 * Pi reads its rebrand config from its own package.json; this suite pins the
 * behavior of the script that writes it.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { BRANDING, brandPi, piPackageJsonPath } from "../scripts/patch";

const RUNTIME = "@earendil-works/pi-coding-agent";

let packageJsonPath: string;

beforeEach(() => {
  packageJsonPath = join(
    mkdtempSync(join(tmpdir(), "dotbot-brand-test-")),
    "package.json",
  );
});

function writePackageJson(content: string): void {
  writeFileSync(packageJsonPath, content);
}

describe("piPackageJsonPath", () => {
  it("points at the installed runtime's own package.json", () => {
    const manifest = JSON.parse(readFileSync(piPackageJsonPath(), "utf8")) as {
      name: string;
    };
    expect(manifest.name).toBe(RUNTIME);
  });
});

describe("brandPi", () => {
  it("writes piConfig into a package.json without one", () => {
    writePackageJson(
      JSON.stringify({ name: "x", version: "1.0.0", main: "index.js" }),
    );

    expect(brandPi(packageJsonPath)).toBe("written");

    const branded = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    expect(branded.piConfig).toEqual(BRANDING);
    expect(branded.name).toBe("x");
    expect(branded.main).toBe("index.js");
  });

  it("replaces a stale piConfig wholesale", () => {
    writePackageJson(
      JSON.stringify({ name: "x", piConfig: { name: "pi", extra: true } }),
    );

    expect(brandPi(packageJsonPath)).toBe("written");

    const branded = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    expect(branded.piConfig).toEqual(BRANDING);
  });

  it("leaves an already-branded package.json untouched", () => {
    const branded = JSON.stringify({ name: "x", piConfig: BRANDING });
    writePackageJson(branded);

    expect(brandPi(packageJsonPath)).toBe("unchanged");
    expect(readFileSync(packageJsonPath, "utf8")).toBe(branded);
  });

  it("preserves field order and formatting outside piConfig", () => {
    const original = `{
  "name": "x",
  "exports": {
    ".": "./index.js"
  },
  "version": "2.0.0"
}
`;
    writePackageJson(original);

    brandPi(packageJsonPath);

    const branded = readFileSync(packageJsonPath, "utf8");
    const lines = branded.split("\n");
    expect(lines.indexOf('  "name": "x",')).toBeLessThan(
      lines.indexOf('  "exports": {'),
    );
    expect(branded).toContain('    ".": "./index.js"');
  });
});
