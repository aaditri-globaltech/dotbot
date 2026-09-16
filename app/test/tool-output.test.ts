import type { AgentToolCall } from "@aria/agent-core";
import { describe, expect, it } from "vitest";
import { toolOutput } from "../src/renderer/components/panels/tool-display";

function writeTool(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    kind: "tool",
    id: "write-1",
    name: "write",
    arguments: JSON.stringify({ path: "notes.txt", content: "written text" }),
    output: "Successfully wrote to notes.txt",
    status: "done",
    ...overrides,
  };
}

describe("toolOutput", () => {
  it("shows the written content instead of the success message", () => {
    expect(toolOutput(writeTool())).toBe("written text");
  });

  it("falls back to the tool result while write arguments are incomplete", () => {
    expect(toolOutput(writeTool({ arguments: "{" }))).toBe(
      "Successfully wrote to notes.txt",
    );
  });

  it("keeps failure output for a failed write", () => {
    expect(
      toolOutput(
        writeTool({ status: "error", output: "EACCES: permission denied" }),
      ),
    ).toBe("EACCES: permission denied");
  });

  it("returns tool output for other tools", () => {
    expect(
      toolOutput(
        writeTool({ name: "bash", arguments: '{"command":"ls"}', output: "a" }),
      ),
    ).toBe("a");
  });
});
