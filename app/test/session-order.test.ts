import type { SessionSummary } from "@dotbot/agent-core";
import { describe, expect, it } from "vitest";
import { orderSessions } from "../src/renderer/components/panels/session-order";

/** Build a summary with the fields the ordering looks at. */
function session(
  id: string,
  lastActivity: string,
  active = false,
): SessionSummary {
  return {
    id,
    projectDir: "/repo",
    title: id,
    status: active ? "running" : "idle",
    active,
    unread: false,
    lastActivity,
  };
}

describe("orderSessions", () => {
  it("puts the selected session first, then running ones, then newest", () => {
    const idle = session("idle", "2026-01-03T00:00:00Z");
    const oldest = session("oldest", "2026-01-01T00:00:00Z");
    const running = session("running", "2026-01-02T00:00:00Z", true);
    const selected = session("selected", "2026-01-04T00:00:00Z");

    expect(orderSessions([idle, running, oldest]).map((s) => s.id)).toEqual([
      "running",
      "idle",
      "oldest",
    ]);
    expect(
      orderSessions([idle, running, oldest, selected], "selected").map(
        (s) => s.id,
      ),
    ).toEqual(["selected", "running", "idle", "oldest"]);
  });

  it("sorts by recency and leaves the input array untouched", () => {
    const sessions = [
      session("a", "2026-01-01T00:00:00Z"),
      session("b", "2026-01-02T00:00:00Z"),
    ];

    expect(orderSessions(sessions).map((s) => s.id)).toEqual(["b", "a"]);
    expect(sessions.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
