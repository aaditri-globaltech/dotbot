import type { AgentSessionSummary } from "@dotbot/agent-core";
import { describe, expect, it } from "vitest";
import { orderTasks } from "../src/renderer/components/panels/task-order";

/** Build a summary with the fields the ordering looks at. */
function task(
  id: string,
  lastActivity: string,
  active = false,
): AgentSessionSummary {
  return {
    id,
    cwd: "/repo",
    title: id,
    status: active ? "running" : "ready",
    active,
    unread: false,
    lastActivity,
  };
}

describe("orderTasks", () => {
  it("puts the selected task first, then running ones, then newest", () => {
    const idle = task("idle", "2026-01-03T00:00:00Z");
    const oldest = task("oldest", "2026-01-01T00:00:00Z");
    const running = task("running", "2026-01-02T00:00:00Z", true);
    const selected = task("selected", "2026-01-04T00:00:00Z");

    expect(orderTasks([idle, running, oldest]).map((t) => t.id)).toEqual([
      "running",
      "idle",
      "oldest",
    ]);
    expect(
      orderTasks([idle, running, oldest, selected], "selected").map(
        (t) => t.id,
      ),
    ).toEqual(["selected", "running", "idle", "oldest"]);
  });

  it("sorts by recency and leaves the input array untouched", () => {
    const tasks = [
      task("a", "2026-01-01T00:00:00Z"),
      task("b", "2026-01-02T00:00:00Z"),
    ];

    expect(orderTasks(tasks).map((t) => t.id)).toEqual(["b", "a"]);
    expect(tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
