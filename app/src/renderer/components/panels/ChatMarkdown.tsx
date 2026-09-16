import { marked, Renderer } from "marked";
import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { CodeHighlight } from "./CodeHighlight";
import { type ChatBlock, parseChatBlocks } from "./chat-markdown";

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value, "https://dotbot.invalid");
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

const markdownRenderer = new Renderer();
markdownRenderer.html = ({ text }) => escapeHtml(text);
markdownRenderer.link = function ({ href, title, tokens }) {
  const safe = safeUrl(href);
  const label = this.parser.parseInline(tokens);
  if (!safe) return label;
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(safe)}"${titleAttribute}>${label}</a>`;
};
markdownRenderer.image = ({ href, title, text }) => {
  const safe = safeUrl(href);
  if (!safe) return escapeHtml(text);
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${titleAttribute}>`;
};

/** Render safe GitHub-flavored Markdown for chat text. */
export function renderMarkdown(text: string): string {
  return marked.parse(text, {
    async: false,
    breaks: true,
    gfm: true,
    renderer: markdownRenderer,
  });
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "dark",
});

let mermaidId = 0;

function MermaidDiagram(props: { code: string }) {
  const [svg, setSvg] = useState("");
  const revisionRef = useRef(0);

  useEffect(() => {
    const currentRevision = ++revisionRef.current;
    setSvg("");
    void mermaid
      .render(`dotbot-mermaid-${++mermaidId}`, props.code)
      .then((result) => {
        if (currentRevision === revisionRef.current) setSvg(result.svg);
      })
      .catch(() => {
        if (currentRevision === revisionRef.current) setSvg("");
      });

    return () => {
      revisionRef.current += 1;
    };
  }, [props.code]);

  if (!svg) {
    return (
      <pre className="agent-code-block agent-mermaid-fallback">
        <code>{props.code}</code>
      </pre>
    );
  }

  return (
    <div className="agent-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** Render one sanitized Markdown fragment. */
export function MarkdownText(props: { text: string; className?: string }) {
  return (
    <div
      className={props.className ?? "agent-markdown-text"}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(props.text) }}
    />
  );
}

function ChatBlockView(props: { block: ChatBlock }) {
  const block = props.block;
  if (block.kind === "text") {
    return <MarkdownText text={block.text} />;
  }
  if (block.kind === "mermaid") {
    return <MermaidDiagram code={block.code} />;
  }
  return <CodeHighlight code={block.code} language={block.language} />;
}

/** Render chat text with fenced code and Mermaid blocks separated. */
export function ChatMarkdown(props: { text: string }) {
  return (
    <div className="agent-markdown">
      {parseChatBlocks(props.text).map((block, index) => (
        <ChatBlockView key={index} block={block} />
      ))}
    </div>
  );
}
