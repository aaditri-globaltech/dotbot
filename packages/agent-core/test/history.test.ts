import { describe, expect, it } from "vitest";
import { compactAgentHistory } from "../src/history";

describe("compactAgentHistory", () => {
  it("keeps user and assistant text, thinking, and tool calls in order", () => {
    const items = compactAgentHistory([
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
      { id: "history-0", role: "user", text: "run it" },
      {
        kind: "thinking",
        id: "history-thinking-1-0",
        text: "thinking about it",
        status: "done",
      },
      { id: "history-1-text-1", role: "assistant", text: "on it" },
      {
        kind: "tool",
        id: "history-tool-call-1",
        name: "bash",
        arguments: '{\n  "command": "ls"\n}',
        output: "a.txt",
        status: "done",
      },
    ]);
  });

  it("marks failed tool results and preserves Pi diffs", () => {
    const items = compactAgentHistory([
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
        id: "history-tool-call-2",
        name: "edit",
        arguments: "{}",
        output: "- old\n+ new",
        status: "error",
      },
    ]);
  });

  it("ignores non-conversation messages", () => {
    expect(
      compactAgentHistory([{ role: "system", content: "hidden" }]),
    ).toEqual([]);
    expect(compactAgentHistory(undefined)).toEqual([]);
  });
});
