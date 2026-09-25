import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/renderer/components/panels/ChatMarkdown";
import { parseChatBlocks } from "../src/renderer/components/panels/chat-markdown";

describe("parseChatBlocks", () => {
  it("keeps an unclosed fence as code", () => {
    expect(parseChatBlocks("before\n```ts\nconst a = 1;")).toEqual([
      { kind: "text", text: "before" },
      { kind: "code", language: "ts", code: "const a = 1;" },
    ]);
  });

  it("separates mermaid blocks so an invalid diagram can fall back to text", () => {
    expect(parseChatBlocks("```mermaid\ngraph TD; A-->B\n```")).toEqual([
      { kind: "mermaid", code: "graph TD; A-->B" },
    ]);
  });

  it("treats an empty document as no blocks", () => {
    expect(parseChatBlocks("")).toEqual([]);
  });

  it("drops whitespace-only prose between fences", () => {
    expect(parseChatBlocks("```\na\n```\n\n```\nb\n```")).toEqual([
      { kind: "code", language: "", code: "a" },
      { kind: "code", language: "", code: "b" },
    ]);
  });
});

describe("renderMarkdown", () => {
  it("drops javascript: links but keeps their label", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("renders raw html as text", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain(
      "<script>",
    );
  });
});
