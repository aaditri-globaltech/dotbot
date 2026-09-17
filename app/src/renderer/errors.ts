/** Message for a promise rejection reason crossing the preload bridge. */
export function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
