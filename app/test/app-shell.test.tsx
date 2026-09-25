// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

// @solidjs/testing-library only registers automatic cleanup when Vitest runs with
// `globals: true`, which this repository does not use.
afterEach(cleanup);

const emptyRange = {
  sessions: 0,
  messages: 0,
  totalTokens: 0,
  activeDays: 0,
  currentStreak: 0,
  longestStreak: 0,
  peakHour: null,
  models: [],
};

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => []),
  onEvent: vi.fn(() => () => undefined),
  stats: vi.fn(async () => ({
    days: [],
    ranges: {
      "365": emptyRange,
      "180": emptyRange,
      "90": emptyRange,
      "30": emptyRange,
      "7": emptyRange,
    },
  })),
}));

vi.mock("../src/renderer/api", () => ({
  api: {
    agent: { list: mocks.list, onEvent: mocks.onEvent },
    stats: { get: mocks.stats },
    // The shell's title strip owns the window controls.
    window: {
      onMaximizedChange: () => () => undefined,
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined,
    },
  },
}));

import App from "../src/renderer/App";

describe("app shell", () => {
  it("renders its empty state on a first launch with no project", async () => {
    render(() => <App />);

    await waitFor(() => expect(mocks.list).toHaveBeenCalled());
    // The shell opens on the dashboard, whose empty state must render without a
    // project, a session list, or any usage statistics.
    expect(await screen.findByText("No sessions yet.")).toBeTruthy();
    expect(screen.getByText("No projects yet.")).toBeTruthy();
  });
});
