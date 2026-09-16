import { describe, expect, it } from "vitest";
import {
  applySessionEvent,
  createSessionClientState,
} from "../src/renderer/components/panels/agent-session-state";

describe("applySessionEvent", () => {
  it("appends a transcript notice for session failures", () => {
    const state = createSessionClientState();
    const next = applySessionEvent(state, { type: "error", message: "boom" });

    expect(state.messages).toEqual([]);
    expect(next.messages).toEqual([
      { kind: "error", id: expect.any(String), text: "boom" },
    ]);
  });
});
