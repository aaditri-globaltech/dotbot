import hljs from "highlight.js/lib/common";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

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
  onScroll?: (event: Event & { currentTarget: HTMLElement }) => void;
  setElement?: (element: HTMLElement | undefined) => void;
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
  const [html, setHtml] = createSignal("");
  const [lines, setLines] = createSignal<HighlightedLine[]>([]);
  let revision = 0;

  const className = () => props.className ?? CODE_BLOCK_CLASS;
  const withLineNumbers = () => props.lineNumbers === true;
  const start = () => lineStart(props.lineNumberStart);

  createEffect(() => {
    const code = props.code;
    const language = props.language;
    const lineNumbers = withLineNumbers();
    const from = start();
    const currentRevision = ++revision;
    setHtml("");
    setLines(lineNumbers ? highlightedLines(code, from) : []);
    const timer = setTimeout(() => {
      if (currentRevision !== revision) return;

      const supportedLanguage =
        language && hljs.getLanguage(language) ? language : undefined;
      if (lineNumbers) {
        setLines(highlightedLines(code, from, supportedLanguage));
        return;
      }
      if (!supportedLanguage) return;
      try {
        setHtml(hljs.highlight(code, { language: supportedLanguage }).value);
      } catch {
        setHtml("");
      }
    }, 0);

    onCleanup(() => {
      revision += 1;
      clearTimeout(timer);
    });
  });

  const hasContent = () =>
    withLineNumbers() ? lines().length > 0 : Boolean(html());

  return (
    <Show
      when={hasContent()}
      fallback={
        <pre
          ref={(element) => props.setElement?.(element)}
          class={className()}
          onScroll={props.onScroll}
        >
          <code>{props.code}</code>
        </pre>
      }
    >
      <Show
        when={withLineNumbers()}
        fallback={
          <div
            ref={(element) => props.setElement?.(element)}
            class={className()}
            onScroll={props.onScroll}
            innerHTML={html()}
          />
        }
      >
        <div
          ref={(element) => props.setElement?.(element)}
          class={`${className()} py-[7px] [overflow-wrap:normal] [white-space:pre]`}
          onScroll={props.onScroll}
        >
          <For each={lines()}>
            {(line) => (
              <span class="flex min-h-[1.45em] min-w-max">
                <span
                  class="shrink-0 basis-[50px] px-3 text-right text-faint select-none"
                  data-line-number="true"
                  decorative="true"
                >
                  {line.number}
                </span>
                <span class="min-w-0 shrink-0 px-3 [white-space:pre]">
                  <Show when={line.html !== undefined} fallback={line.text}>
                    <span innerHTML={line.html} />
                  </Show>
                </span>
              </span>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
