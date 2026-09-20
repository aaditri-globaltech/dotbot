import { describe, expect, it } from "vitest";
import { buildTranscript } from "../src/transcript";

describe("buildTranscript", () => {
  it("keeps user and assistant text, thinking, and tool calls in order", () => {
    const items = buildTranscript([
      { role: "user", content: [{ type: "text", text: "run it" }] },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "thinking about it" },
          { type: "text", text: "on it" },
          {
            type: "toolCall",
            id: "call-1",
            name: "bash",
            arguments: { command: "ls" },
          },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "bash",
        content: [{ type: "text", text: "a.txt" }],
        isError: false,
      },
    ]);

    expect(items).toEqual([
      { id: "transcript-0", role: "user", text: "run it" },
      {
        kind: "thinking",
        id: "transcript-thinking-1-0",
        text: "thinking about it",
        status: "done",
      },
      { id: "transcript-1-text-1", role: "assistant", text: "on it" },
      {
        kind: "tool",
        id: "transcript-tool-call-1",
        name: "bash",
        arguments: '{\n  "command": "ls"\n}',
        output: "a.txt",
        status: "done",
      },
    ]);
  });

  it("marks failed tool results and preserves Pi diffs", () => {
    const items = buildTranscript([
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "call-2", name: "edit", arguments: {} },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "call-2",
        content: [],
        details: { diff: "- old\n+ new" },
        isError: true,
      },
    ]);

    expect(items).toEqual([
      {
        kind: "tool",
        id: "transcript-tool-call-2",
        name: "edit",
        arguments: "{}",
        output: "- old\n+ new",
        status: "error",
      },
    ]);
  });

  it("ignores non-conversation messages", () => {
    expect(buildTranscript([{ role: "system", content: "hidden" }])).toEqual(
      [],
    );
    expect(buildTranscript(undefined)).toEqual([]);
  });
});
