import { describe, expect, it } from "vitest";
import {
  applySessionActivity,
  applySessionError,
  createSessionClientState,
  isBashDraft,
  parseBashCommand,
  parseModelKey,
} from "../src/renderer/components/panels/session-state";

describe("parseBashCommand", () => {
  it("parses ! and !! commands", () => {
    expect(parseBashCommand("!ls -la")).toEqual({
      command: "ls -la",
      excludeFromContext: false,
    });
    expect(parseBashCommand("!!ls")).toEqual({
      command: "ls",
      excludeFromContext: true,
    });
  });

  it("ignores leading whitespace before the bang", () => {
    expect(parseBashCommand("  !ls")).toEqual({
      command: "ls",
      excludeFromContext: false,
    });
    expect(parseBashCommand(" !!ls")).toEqual({
      command: "ls",
      excludeFromContext: true,
    });
  });

  it("returns undefined without a command", () => {
    expect(parseBashCommand("!")).toBeUndefined();
    expect(parseBashCommand("!!   ")).toBeUndefined();
    expect(parseBashCommand("ls")).toBeUndefined();
  });
});

describe("isBashDraft", () => {
  it("recognizes a bang before a command is typed", () => {
    expect(isBashDraft("!")).toBe(true);
    expect(isBashDraft("  !!ls")).toBe(true);
    expect(isBashDraft("hello")).toBe(false);
  });
});

describe("applySessionActivity bash updates", () => {
  it("appends streamed output to an existing bash card", () => {
    const state = {
      ...createSessionClientState(),
      transcript: [
        {
          kind: "bash" as const,
          id: "bash-1",
          command: "ls",
          excludeFromContext: false,
          output: "a",
          truncated: false,
          status: "running" as const,
        },
      ],
    };

    const next = applySessionActivity(state, {
      type: "bash_execution_update",
      id: "bash-1",
      delta: ".txt",
    });

    expect(next.transcript).toMatchObject([
      { id: "bash-1", output: "a.txt", status: "running" },
    ]);
  });

  it("ignores an update that matches no running card", () => {
    const state = createSessionClientState();

    const withoutId = applySessionActivity(state, {
      type: "bash_execution_update",
      delta: "out",
    });
    const unknownId = applySessionActivity(state, {
      type: "bash_execution_update",
      id: "bash-other",
      delta: "out",
    });

    expect(withoutId.transcript).toEqual([]);
    expect(unknownId.transcript).toEqual([]);
  });

  it("ignores output that arrives after the command settled", () => {
    // Batched events can be applied after the executeBash promise resolves.
    const state = {
      ...createSessionClientState(),
      transcript: [
        {
          kind: "bash" as const,
          id: "bash-1",
          command: "ls",
          excludeFromContext: false,
          output: "a.txt",
          truncated: false,
          status: "done" as const,
        },
      ],
    };

    const next = applySessionActivity(state, {
      type: "bash_execution_update",
      id: "bash-1",
      delta: "a.txt",
    });

    expect(next.transcript).toMatchObject([
      { id: "bash-1", output: "a.txt", status: "done" },
    ]);
  });
});

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

describe("parseModelKey", () => {
  it("splits a provider/id key at the first separator", () => {
    expect(parseModelKey("faux/faux-1")).toEqual({
      provider: "faux",
      modelId: "faux-1",
    });
    expect(parseModelKey("openrouter/anthropic/claude")).toEqual({
      provider: "openrouter",
      modelId: "anthropic/claude",
    });
  });

  it("rejects a key without a provider", () => {
    expect(parseModelKey("faux-1")).toBeUndefined();
  });
});
