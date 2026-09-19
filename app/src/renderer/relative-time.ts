/** Compact elapsed-time labels for lists, such as "3h" or "2d". */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** Largest unit first, so the label stays one token wide. */
const UNITS: Array<[number, string]> = [
  [YEAR, "y"],
  [MONTH, "mo"],
  [WEEK, "w"],
  [DAY, "d"],
  [HOUR, "h"],
  [MINUTE, "m"],
];

/**
 * Elapsed time since an ISO timestamp, as produced by the agent manager.
 * Timestamps in the future read as "now".
 */
export function relativeTime(iso: string, now = Date.now()): string {
  const elapsed = now - Date.parse(iso);
  if (elapsed < MINUTE) return "now";

  for (const [size, suffix] of UNITS) {
    if (elapsed >= size) return `${Math.floor(elapsed / size)}${suffix}`;
  }
  return "now";
}
