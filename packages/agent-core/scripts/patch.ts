/**
 * Brand the embedded Pi runtime.
 *
 * Pi reads its rebrand config from its own package.json, and the runtime is
 * installed from npm, so this script writes `piConfig` into the installed
 * copy: app name "bot", config directory ".bot". It runs as this package's
 * postinstall hook; installing with --ignore-scripts skips it, so CI and the
 * README flow run `npm run patch` explicitly. Idempotent: rewrites only
 * when needed.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getPackageDir } from "@earendil-works/pi-coding-agent";

const RUNTIME = "@earendil-works/pi-coding-agent";

/** Rebrand values Pi reads from its `piConfig` package field. */
export const BRANDING = { name: "bot", configDir: ".bot" } as const;

type PackageJson = {
  piConfig?: Record<string, unknown>;
};

/** The installed runtime's package.json, at the root of its package dir. */
export function piPackageJsonPath(): string {
  return join(getPackageDir(), "package.json");
}

/** Apply Dotbot's branding to one runtime package.json. */
export function brandPi(packageJsonPath: string): "written" | "unchanged" {
  const manifest = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as PackageJson;
  if (
    manifest.piConfig?.name === BRANDING.name &&
    manifest.piConfig?.configDir === BRANDING.configDir
  ) {
    return "unchanged";
  }
  manifest.piConfig = { ...BRANDING };
  writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return "written";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const outcome = brandPi(piPackageJsonPath());
  console.log(
    outcome === "written"
      ? `Branded ${RUNTIME} as "${BRANDING.name}" (${BRANDING.configDir})`
      : `${RUNTIME} is already branded`,
  );
}
