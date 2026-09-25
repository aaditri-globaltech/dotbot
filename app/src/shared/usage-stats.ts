/**
 * Usage statistics contract shared by the main process (which computes the
 * numbers from the agent's persisted session files), the preload bridge, and
 * the dashboard.
 */

/** Trailing window rendered day-by-day by the heatmap. */
export const WINDOW_DAYS = 365;

/** Selectable summary windows, keyed by the day count they cover. */
export const RANGE_DAYS = {
  "365": WINDOW_DAYS,
  "180": 180,
  "90": 90,
  "30": 30,
  "7": 7,
} as const;

/** Range identifiers accepted by the dashboard toggle. */
export type UsageRangeKey = keyof typeof RANGE_DAYS;

/** One calendar day of usage, in local time. */
export interface UsageStatsDay {
  /** Local `YYYY-MM-DD`. */
  date: string;
  /** User and assistant messages sent that day. */
  messages: number;
  /** Input plus output tokens reported by assistant messages that day; the
   * sum of `tokensByModel`. */
  tokens: number;
  /** Tokens that day, keyed by model id. */
  tokensByModel: Record<string, number>;
}

/** Token totals for one model over a range. */
export interface UsageModelUsage {
  model: string;
  input: number;
  output: number;
}

/** Summary numbers for one range window. */
export interface UsageRangeStats {
  /** Sessions with at least one message inside the window. */
  sessions: number;
  messages: number;
  totalTokens: number;
  activeDays: number;
  /** Consecutive active days ending today. */
  currentStreak: number;
  /** Longest run of consecutive active days inside the window. */
  longestStreak: number;
  /** Busiest local hour (0-23), or `null` when the range has no activity. */
  peakHour: number | null;
  /** Models used in the window, descending by input plus output. */
  models: UsageModelUsage[];
}

/** Full dashboard payload: the day series plus every range summary. */
export interface UsageStats {
  /** Ascending, length `WINDOW_DAYS`, zero-filled. */
  days: UsageStatsDay[];
  ranges: Record<UsageRangeKey, UsageRangeStats>;
}
