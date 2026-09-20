import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UsageStatsStore } from "../src/main/usage-stats";
import { WINDOW_DAYS } from "../src/shared/usage-stats";

/** Fixed reference instant so day and range math stays deterministic. */
const NOW = new Date("2026-07-05T12:00:00");
const DAY_MS = 86_400_000;

/** Local-time ISO timestamp for a `YYYY-MM-DD` day. */
function isoOn(day: string, hour = 12): string {
  return new Date(
    `${day}T${String(hour).padStart(2, "0")}:00:00`,
  ).toISOString();
}

/** Local `YYYY-MM-DD` for `NOW` shifted by a number of days. */
function dayOffset(days: number): string {
  const date = new Date(NOW.getTime() + days * DAY_MS);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, "0")}`;
}

type MessageOptions = {
  role?: "user" | "assistant";
  model?: string;
  input?: number;
  output?: number;
  hour?: number;
};

/** One persisted session record line. */
function messageLine(day: string, options: MessageOptions = {}): string {
  const { role = "user", model, input = 0, output = 0, hour = 12 } = options;
  const message: Record<string, unknown> = { role };
  if (role === "assistant" && model) {
    message.model = model;
    message.usage = { input, output };
  }
  return JSON.stringify({
    type: "message",
    timestamp: isoOn(day, hour),
    message,
  });
}

const tempDirs: string[] = [];

async function makeStore(): Promise<{
  root: string;
  storePath: string;
  create: (
    sessionId: string,
    lines: string[],
    subdir?: string,
  ) => Promise<string>;
}> {
  const base = await mkdtemp(join(tmpdir(), "dotbot-stats-"));
  tempDirs.push(base);
  const root = join(base, "sessions");
  const storePath = join(base, "usage-stats.json");

  const create = async (
    sessionId: string,
    lines: string[],
    subdir = "",
  ): Promise<string> => {
    const dir = subdir ? join(root, subdir) : root;
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${sessionId}.jsonl`);
    await writeFile(file, lines.join("\n"));
    return file;
  };

  return { root, storePath, create };
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("UsageStatsStore", () => {
  it("aggregates messages, tokens, models, and sessions across files", async () => {
    const { root, storePath, create } = await makeStore();
    await create(
      "s1",
      [
        messageLine("2026-07-04"),
        messageLine("2026-07-04", {
          role: "assistant",
          model: "m-a",
          input: 100,
          output: 900,
        }),
      ],
      "workspace-slug",
    );
    await create("s2", [
      messageLine("2026-07-05", {
        role: "assistant",
        model: "m-b",
        input: 10,
        output: 40,
      }),
    ]);

    const stats = await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);
    const year = stats.ranges["365"];

    expect(year.messages).toBe(3);
    expect(year.sessions).toBe(2);
    expect(year.totalTokens).toBe(1050);
    expect(year.models).toEqual([
      { model: "m-a", input: 100, output: 900 },
      { model: "m-b", input: 10, output: 40 },
    ]);
  });

  it("zero-fills the trailing day window", async () => {
    const { root, storePath, create } = await makeStore();
    await create("s1", [messageLine("2026-07-04")]);

    const { days } = await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);

    expect(days).toHaveLength(WINDOW_DAYS);
    expect(days[days.length - 1]).toEqual({
      date: "2026-07-05",
      messages: 0,
      tokens: 0,
      tokensByModel: {},
    });
    expect(days[days.length - 2]).toEqual({
      date: "2026-07-04",
      messages: 1,
      tokens: 0,
      tokensByModel: {},
    });
  });

  it("limits each range summary to its own window", async () => {
    const { root, storePath, create } = await makeStore();
    await create("s1", [
      messageLine(dayOffset(-40), {
        hour: 9,
        role: "assistant",
        model: "m-a",
        input: 5,
        output: 5,
      }),
      messageLine(dayOffset(0), { hour: 14 }),
    ]);

    const { ranges } = await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);

    expect(ranges["30"].messages).toBe(1);
    expect(ranges["30"].activeDays).toBe(1);
    expect(ranges["90"].messages).toBe(2);
    expect(ranges["90"].activeDays).toBe(2);
    expect(ranges["90"].totalTokens).toBe(10);
    expect(ranges["30"].peakHour).toBe(14);
  });

  it("reports peak hour and streaks", async () => {
    const { root, storePath, create } = await makeStore();
    await create("s1", [
      messageLine("2026-07-03", { hour: 9 }),
      messageLine("2026-07-04", { hour: 9 }),
      messageLine("2026-07-05", { hour: 14 }),
      messageLine("2026-06-20", { hour: 9 }),
      messageLine("2026-06-21", { hour: 9 }),
      messageLine("2026-06-22", { hour: 9 }),
      messageLine("2026-06-23", { hour: 9 }),
      messageLine("2026-06-24", { hour: 9 }),
    ]);

    const year = (
      await new UsageStatsStore({
        sessionsRoot: root,
        storePath,
      }).computeStats(NOW)
    ).ranges["365"];

    expect(year.peakHour).toBe(9);
    expect(year.currentStreak).toBe(3);
    expect(year.longestStreak).toBe(5);
    expect(year.activeDays).toBe(8);
  });

  it("re-parses a session file after it changes", async () => {
    const { root, storePath, create } = await makeStore();
    const file = await create("s1", [messageLine("2026-07-04")]);
    const store = new UsageStatsStore({ sessionsRoot: root, storePath });

    expect((await store.computeStats(NOW)).ranges["365"].messages).toBe(1);

    await writeFile(
      file,
      [messageLine("2026-07-04"), messageLine("2026-07-05")].join("\n"),
    );
    // Force a distinct mtime so the incremental scan cannot skip the file.
    const later = new Date(NOW.getTime() + 60_000);
    await utimes(file, later, later);

    expect((await store.computeStats(NOW)).ranges["365"].messages).toBe(2);
  });

  it("keeps aggregates for deleted sessions across store instances", async () => {
    const { root, storePath, create } = await makeStore();
    const file = await create("s1", [messageLine("2026-07-04")]);

    await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);
    await rm(file);

    const stats = await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);

    expect(stats.ranges["365"].messages).toBe(1);
    expect(stats.ranges["365"].sessions).toBe(1);
  });

  it("rebuilds from the session files when the store cannot be read", async () => {
    const { root, storePath, create } = await makeStore();
    await create("s1", [messageLine("2026-07-04")]);
    await writeFile(storePath, "{ not json");

    const stats = await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);

    expect(stats.ranges["365"].messages).toBe(1);
  });

  it("rebuilds when the store was written by a different format version", async () => {
    const { root, storePath, create } = await makeStore();
    await create("s1", [messageLine("2026-07-04")]);
    // Aggregates from a format this version cannot interpret must be ignored.
    await writeFile(
      storePath,
      JSON.stringify({
        version: 99,
        sessions: {
          legacy: {
            filePath: "/legacy.jsonl",
            mtimeMs: 1,
            days: { "2026-07-05": { messages: 99, models: {}, hours: {} } },
          },
        },
      }),
    );

    const stats = await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);

    expect(stats.ranges["365"].messages).toBe(1);
  });

  it("prunes sessions whose latest activity is older than the retention window", async () => {
    const { root, storePath, create } = await makeStore();
    await create("old", [messageLine(dayOffset(-500))]);

    await new UsageStatsStore({
      sessionsRoot: root,
      storePath,
    }).computeStats(NOW);

    const saved = JSON.parse(await readFile(storePath, "utf-8")) as {
      sessions: Record<string, unknown>;
    };
    expect(Object.keys(saved.sessions)).toEqual([]);
  });
});
