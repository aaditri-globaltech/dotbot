// @vitest-environment jsdom
/** The dashboard usage panel renders its summary, chart, and legend. */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UsageStats, UsageStatsDay } from "../src/shared/usage-stats";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../src/renderer/api", () => ({
  api: { stats: { get: mocks.get } },
}));

import { UsageStatsPanel } from "../src/renderer/components/screen/dashboard/UsageStatsPanel";

afterEach(cleanup);

const day = (date: string, tokens: number): UsageStatsDay => ({
  date,
  messages: tokens > 0 ? 2 : 0,
  tokens,
  tokensByModel: tokens > 0 ? { "faux-1": tokens } : {},
});

const summary = {
  sessions: 3,
  messages: 12,
  totalTokens: 6_600_000,
  activeDays: 4,
  currentStreak: 2,
  longestStreak: 3,
  peakHour: 23,
  models: [{ model: "faux-1", input: 4_000_000, output: 2_600_000 }],
};

const stats: UsageStats = {
  days: [day("2026-01-01", 0), day("2026-01-02", 1200)],
  ranges: {
    "365": summary,
    "180": summary,
    "90": summary,
    "30": summary,
    "7": summary,
  },
};

describe("UsageStatsPanel", () => {
  it("renders the summary and switches to the model legend", async () => {
    mocks.get.mockResolvedValue(stats);
    render(() => <UsageStatsPanel />);

    expect(await screen.findByText("6.6M")).toBeTruthy();
    expect(screen.getByText("Total tokens")).toBeTruthy();
    expect(screen.getByText("11 PM")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Models" }));

    await waitFor(() =>
      expect(screen.getByText("4.0M in · 2.6M out")).toBeTruthy(),
    );
  });
});
