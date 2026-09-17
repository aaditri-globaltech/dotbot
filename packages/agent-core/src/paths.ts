/**
 * Paths the app needs from the agent runtime.
 *
 * The runtime's own directory layout stays in this package, so app code asks
 * for what it needs by name instead of assembling runtime paths itself.
 */

import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * Directory holding persisted sessions, for consumers that read them directly.
 *
 * Named for the runtime's own `getSessionsDir()`, which is the helper
 * `SessionManager` uses but is not part of the package's public entry point
 * (its `exports` map blocks deep imports). Resolving here keeps the runtime
 * path layout inside this package; switch to the runtime helper if it ever
 * becomes public.
 */
export function getSessionsDir(): string {
  return join(getAgentDir(), "sessions");
}
