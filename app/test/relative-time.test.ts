import { describe, expect, it } from "vitest";
import { relativeTime } from "../src/renderer/relative-time";

const now = Date.parse("2026-01-01T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("relativeTime", () => {
  it("uses a single compact unit for each scale", () => {
    expect(relativeTime(ago(5 * 1000), now)).toBe("now");
    expect(relativeTime(ago(5 * MINUTE), now)).toBe("5m");
    expect(relativeTime(ago(3 * HOUR), now)).toBe("3h");
    expect(relativeTime(ago(2 * DAY), now)).toBe("2d");
    expect(relativeTime(ago(10 * DAY), now)).toBe("1w");
    expect(relativeTime(ago(40 * DAY), now)).toBe("1mo");
    expect(relativeTime(ago(400 * DAY), now)).toBe("1y");
  });

  it("reads a future timestamp as now", () => {
    expect(relativeTime(ago(-30 * MINUTE), now)).toBe("now");
  });
});
