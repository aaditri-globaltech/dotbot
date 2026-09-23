import { marked, Renderer } from "marked";
import mermaid from "mermaid";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { CODE_BLOCK_CLASS, CodeHighlight } from "./CodeHighlight";
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
  const [svg, setSvg] = createSignal("");
  let revision = 0;

  createEffect(() => {
    const code = props.code;
    const currentRevision = ++revision;
    setSvg("");
    void mermaid
      .render(`dotbot-mermaid-${++mermaidId}`, code)
      .then((result) => {
        if (currentRevision === revision) setSvg(result.svg);
      })
      .catch(() => {
        if (currentRevision === revision) setSvg("");
      });

    onCleanup(() => {
      revision += 1;
    });
  });

  return (
    <Show when={svg()} fallback={<FallbackDiagram code={props.code} />}>
      <div
        class="max-w-full overflow-auto rounded border border-border bg-surface p-3 [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full"
        innerHTML={svg()}
      />
    </Show>
  );
}

/** The raw block shown while a diagram renders and when it cannot. */
function FallbackDiagram(props: { code: string }) {
  return (
    <pre class={`${CODE_BLOCK_CLASS} [white-space:pre-wrap]`}>
      <code>{props.code}</code>
    </pre>
  );
}

/** Render one sanitized Markdown fragment. */
export function MarkdownText(props: { text: string; className?: string }) {
  return (
    <div
      class={
        props.className ??
        // `agent-markdown-text` carries the element styles for generated HTML.
        "agent-markdown-text text-inherit leading-normal [overflow-wrap:anywhere] [white-space:normal]"
      }
      innerHTML={renderMarkdown(props.text)}
    />
  );
}

function ChatBlockView(props: { block: ChatBlock }) {
  return (
    <Switch>
      <Match when={props.block.kind === "text" ? props.block : undefined}>
        {(block) => <MarkdownText text={block().text} />}
      </Match>
      <Match when={props.block.kind === "mermaid" ? props.block : undefined}>
        {(block) => <MermaidDiagram code={block().code} />}
      </Match>
      <Match when={props.block.kind === "code" ? props.block : undefined}>
        {(block) => (
          <CodeHighlight code={block().code} language={block().language} />
        )}
      </Match>
    </Switch>
  );
}

/** Render chat text with fenced code and Mermaid blocks separated. */
export function ChatMarkdown(props: { text: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-2.5 [overflow-wrap:anywhere] empty:after:inline-block empty:after:h-3 empty:after:w-[5px] empty:after:animate-[agent-blink_900ms_steps(2,jump-none)_infinite] empty:after:bg-accent empty:after:content-['']">
      <For each={parseChatBlocks(props.text)}>
        {(block) => <ChatBlockView block={block} />}
      </For>
    </div>
  );
}
