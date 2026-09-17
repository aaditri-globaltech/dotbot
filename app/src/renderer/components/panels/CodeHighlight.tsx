import hljs from "highlight.js/lib/common";
import { type UIEvent, useEffect, useRef, useState } from "react";

/** Bordered block for code, mermaid fallbacks, and plain tool output. */
export const CODE_BLOCK_CLASS =
  "max-w-full overflow-auto rounded border border-border bg-surface p-3 " +
  "[white-space:pre] font-mono text-xs leading-[1.45]";

/** Inputs for a plain or syntax-highlighted code block. */
export type CodeHighlightProps = {
  code: string;
  language: string;
  className?: string;
  lineNumbers?: boolean;
  lineNumberStart?: number;
  onScroll?: (event: UIEvent<HTMLElement>) => void;
  setElement?: (element: HTMLElement | null) => void;
};

type HighlightedLine = {
  number: number;
  text: string;
  html?: string;
};

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

function lineStart(value: number | undefined) {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(1, Math.trunc(value))
    : 1;
}

function highlightedLines(
  code: string,
  start: number,
  language?: string,
): HighlightedLine[] {
  return code
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((text, index) => {
      if (!language) return { number: start + index, text };
      if (
        language === "diff" &&
        (text.startsWith("-") || text.startsWith("+"))
      ) {
        const type = text.startsWith("+") ? "addition" : "deletion";
        return {
          number: start + index,
          text,
          html: `${escapeHtml(text[0] ?? "")}<span class="hljs-${type}">${escapeHtml(text.slice(1))}</span>`,
        };
      }
      try {
        return {
          number: start + index,
          text,
          html: hljs.highlight(text, { language }).value,
        };
      } catch {
        return { number: start + index, text };
      }
    });
}

/** Render code with optional line numbers and language highlighting. */
export function CodeHighlight(props: CodeHighlightProps) {
  const [html, setHtml] = useState("");
  const [lines, setLines] = useState<HighlightedLine[]>([]);
  const revisionRef = useRef(0);

  const className = props.className ?? CODE_BLOCK_CLASS;
  const withLineNumbers = props.lineNumbers === true;
  const start = lineStart(props.lineNumberStart);

  useEffect(() => {
    const currentRevision = ++revisionRef.current;
    setHtml("");
    setLines(withLineNumbers ? highlightedLines(props.code, start) : []);
    const timer = setTimeout(() => {
      if (currentRevision !== revisionRef.current) return;

      const supportedLanguage =
        props.language && hljs.getLanguage(props.language)
          ? props.language
          : undefined;
      if (withLineNumbers) {
        setLines(highlightedLines(props.code, start, supportedLanguage));
        return;
      }
      if (!supportedLanguage) return;
      try {
        setHtml(
          hljs.highlight(props.code, { language: supportedLanguage }).value,
        );
      } catch {
        setHtml("");
      }
    }, 0);

    return () => {
      revisionRef.current += 1;
      clearTimeout(timer);
    };
  }, [props.code, props.language, start, withLineNumbers]);

  const hasContent = withLineNumbers ? lines.length > 0 : Boolean(html);

  if (!hasContent) {
    return (
      <pre
        ref={props.setElement}
        className={className}
        onScroll={props.onScroll}
      >
        <code>{props.code}</code>
      </pre>
    );
  }

  if (withLineNumbers) {
    return (
      <div
        ref={props.setElement}
        className={`${className} py-[7px] [overflow-wrap:normal] [white-space:pre]`}
        onScroll={props.onScroll}
      >
        {lines.map((line) => (
          <span key={line.number} className="flex min-h-[1.45em] min-w-max">
            <span
              className="shrink-0 basis-[50px] px-3 text-right text-faint select-none"
              data-line-number="true"
              dotbot-hidden="true"
            >
              {line.number}
            </span>
            <span className="min-w-0 shrink-0 px-3 [white-space:pre]">
              {line.html !== undefined ? (
                <span dangerouslySetInnerHTML={{ __html: line.html }} />
              ) : (
                line.text
              )}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={props.setElement}
      className={className}
      onScroll={props.onScroll}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
