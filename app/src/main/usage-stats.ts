/**
 * Dashboard usage statistics, computed from the agent's persisted
 * session files.
 *
 * Each session file is reduced to a per-day rollup and kept in a small JSON
 * store next to the app's other user data, so numbers survive session deletion
 * and repeat runs only parse files whose mtime changed.
 */

import type { Dirent } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  RANGE_DAYS,
  type UsageRangeKey,
  type UsageRangeStats,
  type UsageStats,
  type UsageStatsDay,
  WINDOW_DAYS,
} from "../shared/usage-stats";

const RETENTION_DAYS = 400; // prune sessions idle for ~13 months
const STORE_VERSION = 1;
const JSONL_EXTENSION = ".jsonl";
const MESSAGE_RECORD_TYPE = "message";
const MS_PER_DAY = 86_400_000;

/** Token totals for one model. */
type TokenTotals = { input: number; output: number };

/** Per-day rollup for one session. Kept at day granularity so the dashboard's
 * range toggle stays exact: a session spanning a boundary only contributes the
 * days that fall inside the selected range. */
interface DayBucket {
  messages: number;
  models: Record<string, TokenTotals>;
  hours: Record<string, number>; // local hour (0..23, as string) -> message count
}

/** One session's aggregate, retained even after its file is deleted. */
interface SessionEntry {
  filePath: string;
  mtimeMs: number;
  days: Record<string, DayBucket>; // YYYY-MM-DD -> bucket
}

interface StoreShape {
  version: number;
  sessions: Record<string, SessionEntry>; // sessionId -> entry
}

/** Pooled usage for one day across every retained session. */
interface PooledDay {
  messages: number;
  tokens: number;
  models: Map<string, TokenTotals>;
  hours: number[];
  sessions: Set<string>;
}

export type UsageStatsStoreOptions = {
  /** Directory holding persisted session files (searched recursively). */
  sessionsRoot: string;
  /** JSON file keeping reduced aggregates between runs. */
  storePath: string;
};

/** Local-time `YYYY-MM-DD` for a Date. */
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, "0")}`;
}

function toFiniteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Add one message's usage onto a model's running totals. */
function addUsage(
  totals: Map<string, TokenTotals>,
  model: string,
  usage: TokenTotals,
): void {
  const running = totals.get(model) ?? { input: 0, output: 0 };
  running.input += usage.input;
  running.output += usage.output;
  totals.set(model, running);
}

/** Reduce one session file's JSONL content into a per-day bucket map. */
function parseSessionContent(content: string): Record<string, DayBucket> {
  const days: Record<string, DayBucket> = {};

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;

    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // Skip partially written or corrupt lines.
    }
    if (typeof record !== "object" || record === null) continue;

    const entry = record as {
      type?: unknown;
      timestamp?: unknown;
      message?: unknown;
    };
    if (entry.type !== MESSAGE_RECORD_TYPE) continue;
    if (typeof entry.timestamp !== "string") continue;
    const when = new Date(entry.timestamp);
    if (Number.isNaN(when.getTime())) continue;

    const dayKey = localDayKey(when);
    let bucket = days[dayKey];
    if (!bucket) {
      bucket = { messages: 0, models: {}, hours: {} };
      days[dayKey] = bucket;
    }
    bucket.messages += 1;
    const hourKey = String(when.getHours());
    bucket.hours[hourKey] = (bucket.hours[hourKey] ?? 0) + 1;

    const message = entry.message as
      | {
          role?: unknown;
          model?: unknown;
          usage?: { input?: unknown; output?: unknown };
        }
      | undefined;
    if (
      message &&
      typeof message === "object" &&
      message.role === "assistant" &&
      typeof message.model === "string" &&
      message.usage &&
      typeof message.usage === "object"
    ) {
      const model = bucket.models[message.model] ?? { input: 0, output: 0 };
      bucket.models[message.model] = model;
      model.input += toFiniteNumber(message.usage.input);
      model.output += toFiniteNumber(message.usage.output);
    }
  }

  return days;
}

/** Newest day key present in a session entry, or `""` when it has no days. */
function newestDay(entry: SessionEntry): string {
  let newest = "";
  for (const key of Object.keys(entry.days)) if (key > newest) newest = key;
  return newest;
}

/** Collect session files recursively; missing directories yield an empty list. */
async function collectSessionFiles(
  dir: string,
  found: string[],
): Promise<void> {
  let items: Dirent[];
  try {
    items = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const item of items) {
    const full = join(dir, item.name);
    if (item.isDirectory()) await collectSessionFiles(full, found);
    else if (item.isFile() && item.name.endsWith(JSONL_EXTENSION))
      found.push(full);
  }
}

/** Persisted usage statistics for the dashboard. */
export class UsageStatsStore {
  private readonly sessionsRoot: string;
  private readonly storePath: string;
  private store: StoreShape = { version: STORE_VERSION, sessions: {} };
  private loaded = false;
  private dirty = false;

  constructor(options: UsageStatsStoreOptions) {
    this.sessionsRoot = options.sessionsRoot;
    this.storePath = options.storePath;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    let parsed: Partial<StoreShape> | undefined;
    try {
      parsed = JSON.parse(await readFile(this.storePath, "utf-8"));
    } catch {
      return; // Missing or unreadable store: rebuild from the session files.
    }

    // A store written by another format version is rebuilt rather than read as
    // if it were current.
    if (
      parsed?.version === STORE_VERSION &&
      typeof parsed.sessions === "object" &&
      parsed.sessions
    ) {
      this.store = { version: STORE_VERSION, sessions: parsed.sessions };
    }
  }

  /** Re-parse new or changed session files, prune stale ones, save if changed. */
  private async refresh(now: Date): Promise<void> {
    await this.ensureLoaded();

    const files: string[] = [];
    await collectSessionFiles(this.sessionsRoot, files);

    for (const file of files) {
      // A session's id is its file name without the extension.
      const id = basename(file, JSONL_EXTENSION);

      let mtimeMs: number;
      try {
        mtimeMs = (await stat(file)).mtimeMs;
      } catch {
        continue;
      }

      const existing = this.store.sessions[id];
      if (
        existing &&
        existing.filePath === file &&
        existing.mtimeMs === mtimeMs
      ) {
        continue;
      }

      try {
        const content = await readFile(file, "utf-8");
        this.store.sessions[id] = {
          filePath: file,
          mtimeMs,
          days: parseSessionContent(content),
        };
        this.dirty = true;
      } catch {
        // Unreadable now; keep any earlier aggregate instead of dropping it.
      }
    }

    if (this.prune(now)) this.dirty = true;
    // One scan per dashboard load, so saving inline keeps persistence exact.
    if (this.dirty) await this.save();
  }

  /** Scan session files and aggregate everything into a dashboard payload. */
  async computeStats(now: Date = new Date()): Promise<UsageStats> {
    await this.refresh(now);
    return this.aggregate(now);
  }

  /** Drop sessions whose newest day falls outside the retention window. */
  private prune(now: Date): boolean {
    const cutoff = localDayKey(
      new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY),
    );
    let changed = false;

    for (const [id, entry] of Object.entries(this.store.sessions)) {
      const newest = newestDay(entry);
      if (newest === "" || newest < cutoff) {
        delete this.store.sessions[id];
        changed = true;
      }
    }

    return changed;
  }

  /** Pool every retained session into per-day activity, then summarise ranges. */
  private aggregate(now: Date): UsageStats {
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayKey = localDayKey(todayMidnight);
    const windowStartKey = localDayKey(
      new Date(todayMidnight.getTime() - (WINDOW_DAYS - 1) * MS_PER_DAY),
    );

    const perDay = new Map<string, PooledDay>();
    const dayOf = (key: string): PooledDay => {
      let day = perDay.get(key);
      if (!day) {
        day = {
          messages: 0,
          tokens: 0,
          models: new Map(),
          hours: new Array<number>(24).fill(0),
          sessions: new Set(),
        };
        perDay.set(key, day);
      }
      return day;
    };

    for (const [id, entry] of Object.entries(this.store.sessions)) {
      for (const [dayKey, bucket] of Object.entries(entry.days)) {
        if (dayKey < windowStartKey || dayKey > todayKey) continue;

        const day = dayOf(dayKey);
        day.messages += bucket.messages;
        day.sessions.add(id);

        for (const [model, usage] of Object.entries(bucket.models)) {
          day.tokens += usage.input + usage.output;
          addUsage(day.models, model, usage);
        }

        for (const [hourKey, count] of Object.entries(bucket.hours)) {
          const hour = Number(hourKey);
          if (hour >= 0 && hour < 24) day.hours[hour] += count;
        }
      }
    }

    // Zero-filled ascending series so the heatmap and token chart stay dense.
    const days: UsageStatsDay[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const key = localDayKey(
        new Date(todayMidnight.getTime() - i * MS_PER_DAY),
      );
      const day = perDay.get(key);
      const tokensByModel: Record<string, number> = {};
      if (day) {
        for (const [model, usage] of day.models) {
          tokensByModel[model] = usage.input + usage.output;
        }
      }
      days.push({
        date: key,
        messages: day?.messages ?? 0,
        tokens: day?.tokens ?? 0,
        tokensByModel,
      });
    }

    const ranges = {} as Record<UsageRangeKey, UsageRangeStats>;
    for (const key of Object.keys(RANGE_DAYS) as UsageRangeKey[]) {
      ranges[key] = this.aggregateRange(perDay, todayMidnight, RANGE_DAYS[key]);
    }

    return { days, ranges };
  }

  private aggregateRange(
    perDay: Map<string, PooledDay>,
    todayMidnight: Date,
    rangeDays: number,
  ): UsageRangeStats {
    const todayKey = localDayKey(todayMidnight);
    const startKey = localDayKey(
      new Date(todayMidnight.getTime() - (rangeDays - 1) * MS_PER_DAY),
    );

    let messages = 0;
    let totalTokens = 0;
    const sessions = new Set<string>();
    const models = new Map<string, TokenTotals>();
    const hours = new Array<number>(24).fill(0);
    const activeDayKeys = new Set<string>();

    for (const [dayKey, day] of perDay) {
      if (dayKey < startKey || dayKey > todayKey) continue;

      if (day.messages > 0) activeDayKeys.add(dayKey);
      messages += day.messages;
      totalTokens += day.tokens;
      for (const id of day.sessions) sessions.add(id);
      for (const [model, usage] of day.models) addUsage(models, model, usage);
      for (let hour = 0; hour < 24; hour++) hours[hour] += day.hours[hour];
    }

    let peakHour: number | null = null;
    let peakCount = 0;
    for (let hour = 0; hour < 24; hour++) {
      if (hours[hour] > peakCount) {
        peakCount = hours[hour];
        peakHour = hour;
      }
    }

    const modelList = [...models.entries()]
      .map(([model, usage]) => ({
        model,
        input: usage.input,
        output: usage.output,
      }))
      .sort((a, b) => b.input + b.output - (a.input + a.output));

    const { currentStreak, longestStreak } = computeStreaks(
      activeDayKeys,
      todayMidnight,
      rangeDays,
    );

    return {
      sessions: sessions.size,
      messages,
      totalTokens,
      activeDays: activeDayKeys.size,
      currentStreak,
      longestStreak,
      peakHour,
      models: modelList,
    };
  }

  private async save(): Promise<void> {
    this.dirty = false;

    try {
      await mkdir(dirname(this.storePath), { recursive: true });
      const temporary = `${this.storePath}.tmp`;
      await writeFile(temporary, JSON.stringify(this.store), "utf-8");
      await rename(temporary, this.storePath);
    } catch (error) {
      this.dirty = true; // Retry on the next scan.
      console.error("Failed to save usage stats:", error);
    }
  }
}

/** Longest and current (ending today) run of consecutive active days in range. */
function computeStreaks(
  activeDayKeys: Set<string>,
  todayMidnight: Date,
  rangeDays: number,
): { currentStreak: number; longestStreak: number } {
  let currentStreak = 0;
  for (let i = 0; i < rangeDays; i++) {
    const key = localDayKey(new Date(todayMidnight.getTime() - i * MS_PER_DAY));
    if (!activeDayKeys.has(key)) break;
    currentStreak += 1;
  }

  let longestStreak = 0;
  let run = 0;
  for (let i = rangeDays - 1; i >= 0; i--) {
    const key = localDayKey(new Date(todayMidnight.getTime() - i * MS_PER_DAY));
    if (activeDayKeys.has(key)) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  return { currentStreak, longestStreak };
}
