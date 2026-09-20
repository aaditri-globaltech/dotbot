import { describe, expect, it } from "vitest";
import {
  applySessionError,
  createSessionClientState,
} from "../src/renderer/components/panels/session-state";

describe("applySessionError", () => {
  it("appends a transcript notice for session failures", () => {
    const state = createSessionClientState();
    const next = applySessionError(state, "boom");

    expect(state.transcript).toEqual([]);
    expect(next.transcript).toEqual([
      { kind: "error", id: expect.any(String), text: "boom" },
    ]);
  });
});
