/** Render the normalized chat stream, controls, and extension dialog. */

import type {
  BashExecution,
  ExtensionResponse,
  ModelThinkingLevel,
  SessionSummary,
  StreamingBehavior,
  ToolCall,
  TranscriptItem,
  TrustRequest,
} from "@dotbot/agent-core";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import { createAutoScroll } from "../../hooks/auto-scroll";
import { createGitStatus } from "../../hooks/git-status";
import {
  DEFAULT_EDITOR_KEYBINDINGS,
  formatKeybinding,
  matchesKey,
} from "../../keybindings";
import { projectName } from "../../project-name";
import { BashExecutionView } from "./BashExecutionView";
import { ChatMarkdown, MarkdownText } from "./ChatMarkdown";
import { CodeHighlight } from "./CodeHighlight";
import { Dropdown } from "./Dropdown";
import { ExtensionDialog } from "./ExtensionDialog";
import { Hero } from "./Hero";
import { SECONDARY_BUTTON_CLASS } from "./panel-classes";
import {
  isBashDraft,
  isBashExecution,
  isErrorNotice,
  isThinking,
  isToolCall,
  modelKey,
  parseBashCommand,
  parseModelKey,
  type SessionClientState,
} from "./session-state";
import { statusDotClass } from "./status-dot";
import { TrustPrompt } from "./TrustPrompt";
import {
  bashCommand,
  readToolOffset,
  readToolRange,
  toolOutput,
  toolOutputLanguage,
  toolPath,
  toolStatusColor,
  toolStatusText,
} from "./tool-display";

/** Message bubble shared by user and assistant turns. */
const MESSAGE_CLASS =
  "max-w-full text-sm leading-normal [overflow-wrap:anywhere] " +
  "[white-space:pre-wrap]";

/** Tool card frame and its collapsible command row. */
const TOOL_CALL_CLASS =
  "group self-start w-[95%] max-w-[95%] min-w-0 rounded border " +
  "border-border bg-surface font-mono text-xs leading-[1.45]";
const TOOL_COMMAND_CLASS =
  "flex cursor-pointer list-none items-start gap-2 px-2 py-[7px] " +
  "select-none [overflow-wrap:anywhere] hover:bg-input focus-visible:ring-1 " +
  "focus-visible:ring-focus before:flex-none before:text-dim " +
  "before:content-['▸'] group-open:before:content-['▾']";

function statusLabel(session: SessionSummary) {
  if (session.status === "waiting") return "Waiting for input";
  if (session.status === "running") return "Working…";
  if (session.status === "starting") return "Starting session…";
  if (session.status === "error") return "Error";
  return "Idle";
}

/** Status text color, so waiting and failures stand out from idle. */
function statusTextClass(status: SessionSummary["status"]) {
  if (status === "waiting") return "text-warning";
  if (status === "error") return "text-error";
  return "text-dim";
}

/** Keep the latest transcript window responsive; older items load on demand. */
const MAX_TRANSCRIPT_ITEMS = 80;

/** Diff markers and line numbers hidden when a tool card shows an edit. */
const EDIT_OUTPUT_CLASS =
  "text-muted [&_[data-line-number]]:hidden [&_.hljs-addition]:px-px " +
  "[&_.hljs-addition]:bg-[#243a29] [&_.hljs-addition]:text-[#9cdc9c] " +
  "[&_.hljs-deletion]:px-px [&_.hljs-deletion]:bg-[#3a2424] " +
  "[&_.hljs-deletion]:text-[#d49a92]";

function ToolOutput(props: { tool: ToolCall }) {
  const output = () => toolOutput(props.tool);
  const language = () => toolOutputLanguage(props.tool);
  const lineNumberStart = () =>
    props.tool.name === "read" ? readToolOffset(props.tool) : 1;
  const scroll = createAutoScroll<HTMLElement>(output);
  const failure = () => props.tool.status === "error";
  const outputClass = () =>
    failure()
      ? "max-h-[234px] overflow-auto px-3 py-[7px] text-error " +
        "[overflow-wrap:anywhere] [white-space:pre-wrap]"
      : "max-h-[234px] overflow-auto px-3 py-[7px] " +
        "[overflow-wrap:anywhere] [white-space:pre-wrap]";
  return (
    <CodeHighlight
      code={output()}
      language={language()}
      className={`${outputClass()} ${props.tool.name === "edit" ? EDIT_OUTPUT_CLASS : ""}`}
      lineNumbers={
        !failure() && ["edit", "read", "write"].includes(props.tool.name)
      }
      lineNumberStart={lineNumberStart()}
      setElement={scroll.setElement}
      onScroll={scroll.onScroll}
    />
  );
}

function ChatItem(props: {
  item: () => TranscriptItem | undefined;
  projectDir: string;
}) {
  // The item is read through the accessor: the store replaces transcript items
  // on every streamed flush, and reading them here keeps this row's DOM alive.
  const item = () => props.item();
  /** The item when it is of one kind, so each branch narrows to its own type. */
  const pick = <T extends TranscriptItem>(
    matches: (value: TranscriptItem) => value is T,
  ) => {
    const current = item();
    return current && matches(current) ? current : undefined;
  };
  const errorNotice = () => pick(isErrorNotice);
  const thinking = () => pick(isThinking);
  const bash = () => pick(isBashExecution);
  const tool = () => pick(isToolCall);
  const message = () => {
    const current = item();
    return current && "role" in current ? current : undefined;
  };

  return (
    <>
      <Show when={errorNotice()}>
        {(notice) => (
          <div
            class="max-w-full self-start rounded border border-error/35 bg-error/10 px-2.5 py-1.5 text-[13px] leading-[1.45] text-error [overflow-wrap:anywhere] [white-space:pre-wrap]"
            role="alert"
          >
            {notice().text}
          </div>
        )}
      </Show>

      <Show when={thinking()}>
        {(block) => (
          <div class="max-w-full self-start px-2 text-[13px] leading-[1.45] text-muted italic [overflow-wrap:anywhere] [white-space:pre-wrap]">
            <MarkdownText text={block().text} />
          </div>
        )}
      </Show>

      <Show when={bash()}>{(item) => <BashExecutionView item={item()} />}</Show>

      <Show when={tool()}>
        {(call) => {
          const path = () =>
            call().name === "bash"
              ? bashCommand(call())
              : toolPath(call(), props.projectDir);
          const range = () =>
            call().name === "read" ? readToolRange(call()) : "";
          const argument = () =>
            call().name === "bash"
              ? bashCommand(call())
              : path()
                ? `${path()}${range()}`
                : undefined;
          const showPrompt = () =>
            call().name === "bash" ||
            !["read", "edit", "write"].includes(call().name);
          const showToolName = () =>
            call().name !== "bash" || argument() === undefined;

          return (
            <details class={TOOL_CALL_CLASS} open={call().name !== "read"}>
              <summary
                ref={(element) => {
                  if (element && call().name === "bash") element.scrollTop = 0;
                }}
                class={`${TOOL_COMMAND_CLASS} ${
                  call().name === "bash"
                    ? "max-h-[calc(4*1.45em+14px)] overflow-x-hidden overflow-y-auto [overflow-anchor:none] [overscroll-behavior:auto]"
                    : ""
                }`}
              >
                <Show when={showPrompt()}>
                  <span class="shrink-0 font-semibold text-secondary">$</span>
                </Show>
                <Show when={showToolName()}>
                  <span class="shrink-0 font-semibold whitespace-nowrap text-code">
                    {call().name}
                  </span>
                </Show>
                <Show when={argument()}>
                  {(value) => (
                    <span class="flex min-w-0 flex-1 [overflow-wrap:break-word]">
                      <span class="min-w-0 flex-1 [overflow-wrap:break-word]">
                        {call().name === "read" && path() ? path() : value()}
                      </span>
                      <Show when={call().name === "read" && range()}>
                        <span class="ml-1 shrink-0 text-[10px] font-semibold whitespace-nowrap text-code">
                          {range()}
                        </span>
                      </Show>
                    </span>
                  )}
                </Show>
                <span
                  class={`${statusDotClass(toolStatusColor(call().status))} mt-[5px] ml-auto`}
                  role="img"
                  label={`Tool ${toolStatusText(call().status)}`}
                  title={`Tool ${toolStatusText(call().status)}`}
                />
              </summary>
              <Show when={toolOutput(call())}>
                <ToolOutput tool={call()} />
              </Show>
            </details>
          );
        }}
      </Show>

      <Show when={message()}>
        {(item) => {
          const roleClass = () =>
            item().role === "user"
              ? "self-end max-w-[min(80%,720px)] rounded border border-border bg-input px-2.5 py-2 [white-space:normal]"
              : "self-start px-2";
          return (
            <article class={`${MESSAGE_CLASS} ${roleClass()}`}>
              <div class="min-w-0">
                <ChatMarkdown text={item().text} />
              </div>
            </article>
          );
        }}
      </Show>
    </>
  );
}

/** Inputs for the selected Agent transcript and controls. */
export type SessionViewProps = {
  selectedSession?: SessionSummary;
  state?: SessionClientState;
  /** Whether the composer shows the new session draft instead of a session. */
  drafting: boolean;
  /** Projects offered by the composer's project menu. */
  projects: string[];
  /** Project the selected session or newSession runs in. */
  projectDir?: string;
  /** Pending app-level trust decision, rendered above the composer. */
  trustRequest?: TrustRequest;
  onSelectProject: (projectDir: string) => void;
  onDraft: (value: string) => void;
  onPrompt: (message: string, streamingBehavior?: StreamingBehavior) => void;
  /** Run a `!`/`!!` composer command as UI-driven bash. */
  onRunBash: (command: string, excludeFromContext: boolean) => void;
  onAbort: () => void;
  onSetModel: (provider: string, modelId: string) => void;
  onSetThinkingLevel: (level: ModelThinkingLevel) => void;
  onRespond: (response: ExtensionResponse) => void;
  /** Answers the app-level trust prompt. */
  onRespondTrust: (response: ExtensionResponse) => void;
  /** Whether the active project runs without its own resources. */
  untrustedNotice?: boolean;
};

/** Render session tabs, transcript controls, and the prompt composer. */
export function SessionView(props: SessionViewProps) {
  const status = () => props.selectedSession?.status;
  const git = createGitStatus(() => props.projectDir);
  // Only a real repository has a branch to show next to the project.
  const branch = () => {
    const status = git.status();
    return status?.repoRoot ? status.branch : undefined;
  };
  const busy = () =>
    status() === "starting" || status() === "running" || status() === "waiting";
  const running = () => status() === "running";
  const bashRunning = () => props.state?.activeBash !== undefined;
  const trustPending = () => props.trustRequest !== undefined;
  const inputDisabled = () => status() === "waiting" || trustPending();
  const extensionRequest = () => props.selectedSession?.waiting;
  const trustPrompt = () => props.trustRequest;
  let composer: HTMLTextAreaElement | undefined;
  let hadTrustPrompt = false;
  createEffect(() => {
    if (props.trustRequest) {
      hadTrustPrompt = true;
      return;
    }
    if (hadTrustPrompt) {
      hadTrustPrompt = false;
      composer?.focus();
    }
  });
  const [streamingBehavior, setStreamingBehavior] =
    createSignal<StreamingBehavior>("steer");
  const [transcriptPages, setTranscriptPages] = createSignal<
    Record<string, number>
  >({});
  const transcript = () => props.state?.transcript ?? [];
  // A bash run started during an agent turn renders above the composer until
  // it settles, then moves into the transcript flow.
  const activeBash = () => props.state?.activeBash;
  const isPendingBash = (item: TranscriptItem): item is BashExecution =>
    isBashExecution(item) &&
    activeBash()?.pending === true &&
    item.id === activeBash()?.id;
  // One command runs at a time, so the strip above the composer holds one card.
  const pendingBashItem = () => transcript().find(isPendingBash);
  const transcriptItems = createMemo(() =>
    transcript().filter((item) => !isPendingBash(item)),
  );
  const sessionId = () => props.selectedSession?.id;
  const pages = () => {
    const id = sessionId();
    return id ? (transcriptPages()[id] ?? 0) : 0;
  };
  // Only the newest window is rendered; older items wait behind the button.
  const windowedItems = createMemo(() =>
    transcriptItems().slice(
      Math.max(
        0,
        transcriptItems().length - MAX_TRANSCRIPT_ITEMS * (pages() + 1),
      ),
    ),
  );
  const olderItemCount = () =>
    transcriptItems().length - windowedItems().length;
  // Rows render by id: <For> keys by reference, and the store hands out a new
  // object for every streamed delta, so reference keying would rebuild the row.
  const transcriptIds = () => windowedItems().map((item) => item.id);
  const transcriptItemById = (id: string) =>
    windowedItems().find((item) => item.id === id);
  const loadOlderItems = () => {
    const id = sessionId();
    if (!id) return;
    setTranscriptPages((current) => ({
      ...current,
      [id]: (current[id] ?? 0) + 1,
    }));
  };
  const messageScroll = createAutoScroll<HTMLElement>(
    () => props.state?.transcript,
    () => props.selectedSession?.id,
  );
  // The composer only renders for a session or the newSession, both of which have state.
  const composerState = () =>
    props.drafting || props.selectedSession ? props.state : undefined;
  const bashMode = () => {
    const state = composerState();
    return state ? isBashDraft(state.draft) : false;
  };
  const trustSelect = () => {
    const request = trustPrompt();
    return request && request.method === "select" ? request : undefined;
  };
  const trustDialog = () => {
    const request = trustPrompt();
    return request && request.method !== "select" ? request : undefined;
  };

  const send = (draft: string) => {
    if (inputDisabled()) return;
    // A leading bang runs a bash command instead of prompting the agent.
    if (isBashDraft(draft)) {
      if (bashRunning()) return;
      const bash = parseBashCommand(draft);
      if (bash) {
        props.onDraft("");
        props.onRunBash(bash.command, bash.excludeFromContext);
      }
      return;
    }
    // Running turns can be steered or queued; idle turns always start normally.
    const message = draft.trim();
    if (message) {
      props.onPrompt(message, running() ? streamingBehavior() : undefined);
    }
  };

  const handleKeyDown = (event: KeyboardEvent, draft: string) => {
    if (
      !matchesKey(event, DEFAULT_EDITOR_KEYBINDINGS.submit) ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    send(draft);
  };

  const selectModel = (value: string) => {
    const model = parseModelKey(value);
    if (model) props.onSetModel(model.provider, model.modelId);
  };

  return (
    <section
      id="view"
      class="panel view-panel relative flex flex-col overflow-hidden bg-surface"
    >
      <Show when={props.untrustedNotice}>
        <div class="shrink-0 border-b border-border bg-card px-5 py-1.5 text-[11px] text-muted">
          Project resources and packages are ignored because this folder is not
          trusted.
        </div>
      </Show>
      <Switch
        fallback={
          <Hero
            title="No session open"
            hint="Pick one from the sidebar, or start a new session."
          />
        }
      >
        <Match when={props.drafting}>
          <Hero
            title={`Start a session in ${projectName(props.projectDir ?? "")}`}
            hint="Describe what you want help with."
          />
        </Match>
        <Match
          when={
            props.selectedSession &&
            props.state &&
            props.selectedSession.status !== "starting"
          }
        >
          <div class="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div
              ref={messageScroll.setElement}
              class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
              onScroll={messageScroll.onScroll}
            >
              <Show
                when={transcriptItems().length > 0}
                fallback={
                  <Hero
                    title={`Start a session in ${projectName(props.projectDir ?? "")}`}
                    hint="Describe what you want help with."
                  />
                }
              >
                <Show when={olderItemCount() > 0}>
                  <button
                    class="cursor-pointer self-center rounded-md border border-border-strong bg-card px-2.5 py-1 text-[11px] text-muted hover:border-focus hover:text-secondary"
                    type="button"
                    onClick={loadOlderItems}
                  >
                    Load older items
                  </button>
                </Show>
                <For each={transcriptIds()}>
                  {(id) => (
                    <ChatItem
                      item={() => transcriptItemById(id)}
                      projectDir={props.selectedSession?.projectDir ?? ""}
                    />
                  )}
                </For>
              </Show>
            </div>
            <Show
              when={
                !messageScroll.isFollowing() && transcriptItems().length > 0
              }
            >
              <button
                class="absolute bottom-3 left-1/2 z-2 grid size-[26px] -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-border-strong bg-card text-secondary shadow-[0_2px_8px_rgb(0_0_0/35%)] hover:border-focus hover:text-primary focus-visible:ring-1 focus-visible:ring-focus focus-visible:ring-offset-2"
                type="button"
                label="Jump to latest message"
                title="Jump to latest message"
                onClick={messageScroll.jumpToBottom}
              >
                <span class="codicon codicon-chevron-down" decorative="true" />
              </button>
            </Show>
          </div>
        </Match>
        <Match when={props.selectedSession}>
          <div class="grid flex-1 place-items-center text-xs text-dim">
            Starting session…
          </div>
        </Match>
      </Switch>

      <Show when={composerState()}>
        {(state) => (
          <div class="shrink-0 px-5 pt-1.5 pb-4">
            <Show when={pendingBashItem()}>
              {(item) => (
                <div class="mx-auto mb-2 flex w-full max-w-[860px] flex-col gap-2">
                  <BashExecutionView item={item()} />
                </div>
              )}
            </Show>
            {/* The dialogue is a layer behind the composer card: it tucks 24px
                behind the card's rounded top corners (its rounded-3xl radius) and
                pads that 24px plus a 12px gap back, so its content stays above the
                card and it grows upward without moving the composer. */}
            <div class="relative mx-auto w-full max-w-[860px]">
              <Show when={trustSelect() || props.drafting}>
                <div
                  class={`absolute inset-x-0 bottom-[calc(100%_-_24px)] rounded-3xl bg-card px-5 pt-4 pb-9 ${trustSelect() ? "trust-prompt" : ""}`}
                >
                  <Show when={trustSelect()} keyed>
                    {(request) => (
                      <TrustPrompt
                        request={request}
                        onRespond={props.onRespondTrust}
                      />
                    )}
                  </Show>
                  <Show when={!trustSelect() && props.drafting}>
                    <div class="flex min-w-0 items-center gap-2 text-sm text-secondary">
                      <Dropdown
                        label="Project"
                        icon="codicon-folder"
                        value={props.projectDir ?? ""}
                        onChange={props.onSelectProject}
                        placement="up"
                        className="max-w-[220px]"
                        options={props.projects.map((project) => ({
                          value: project,
                          label: projectName(project),
                          description: project,
                        }))}
                      />
                      <Show when={branch()}>
                        <span
                          class="codicon codicon-git-branch ml-1 shrink-0 text-[13px] text-dim"
                          decorative="true"
                        />
                        <span class="min-w-0 truncate text-muted">
                          {branch()}
                        </span>
                      </Show>
                    </div>
                  </Show>
                </div>
              </Show>
              <form
                class={`relative rounded-3xl border bg-elevated px-4 pt-3.5 pb-2.5 transition-colors focus-within:ring-1 ${
                  bashMode()
                    ? "border-bash focus-within:ring-bash/40"
                    : "border-border-strong focus-within:ring-border-strong"
                }`}
                onSubmit={(event) => {
                  event.preventDefault();
                  send(state().draft);
                }}
              >
                <textarea
                  ref={(element) => {
                    composer = element;
                  }}
                  class="block field-sizing-content max-h-[220px] min-h-[52px] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[13px] leading-[1.5] text-secondary outline-0 placeholder:text-faint focus:outline-none disabled:opacity-60"
                  label="Send message"
                  placeholder="Ask Dotbot…"
                  rows={3}
                  value={state().draft}
                  disabled={inputDisabled()}
                  onInput={(event) => props.onDraft(event.currentTarget.value)}
                  onKeyDown={(event) => handleKeyDown(event, state().draft)}
                />
                <div class="mt-1.5 flex items-center gap-1.5">
                  <Show when={props.selectedSession}>
                    {(session) => (
                      <span
                        class={`shrink-0 text-[11px] whitespace-nowrap ${statusTextClass(session().status)}`}
                      >
                        {statusLabel(session())}
                      </span>
                    )}
                  </Show>
                  <Show when={running() || bashRunning()}>
                    <button
                      class={`${SECONDARY_BUTTON_CLASS} shrink-0 border-error/50 text-error`}
                      type="button"
                      onClick={props.onAbort}
                    >
                      Stop
                    </button>
                  </Show>
                  <Show when={running()}>
                    <span class="flex shrink-0 items-center gap-1 text-[11px] whitespace-nowrap text-dim">
                      Send as
                      <Dropdown
                        label="Streaming behavior"
                        value={streamingBehavior()}
                        placement="up"
                        align="right"
                        onChange={setStreamingBehavior}
                        options={[
                          { value: "steer", label: "Steer" },
                          { value: "followUp", label: "Follow up" },
                        ]}
                      />
                    </span>
                  </Show>
                  <span class="min-w-0 flex-1 truncate text-[11px] text-faint">
                    {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.submit)} sends
                    · {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.newline)}{" "}
                    adds a line · ! runs a command
                  </span>
                  <Dropdown
                    label="Model"
                    searchable
                    className="max-w-[190px]"
                    value={state().selectedModel}
                    placement="up"
                    align="right"
                    placeholder={
                      state().models.length === 0
                        ? "Loading models…"
                        : undefined
                    }
                    disabled={busy() || state().models.length === 0}
                    onChange={selectModel}
                    options={state().models.map((model) => ({
                      value: modelKey(model),
                      label: model.name,
                      description: model.provider,
                    }))}
                  />
                  <Dropdown
                    label="Thinking level"
                    icon="codicon-lightbulb"
                    value={state().thinkingLevel}
                    placement="up"
                    align="right"
                    placeholder={
                      state().thinkingLevels.length === 0
                        ? "Loading levels…"
                        : undefined
                    }
                    disabled={busy() || state().thinkingLevels.length === 0}
                    onChange={(level) =>
                      props.onSetThinkingLevel(level as ModelThinkingLevel)
                    }
                    options={state().thinkingLevels.map((level) => ({
                      value: level,
                      label: level,
                    }))}
                  />
                  <button
                    class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-app disabled:cursor-default disabled:bg-elevated disabled:text-dim"
                    type="submit"
                    label="Send message"
                    title="Send message"
                    disabled={inputDisabled() || !state().draft.trim()}
                  >
                    <span
                      class="codicon codicon-arrow-up text-[13px]"
                      decorative="true"
                    />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Show>
      <Show when={extensionRequest()}>
        {(request) => (
          <ExtensionDialog request={request()} onRespond={props.onRespond} />
        )}
      </Show>
      <Show when={trustDialog()}>
        {(request) => (
          <ExtensionDialog
            request={request()}
            onRespond={props.onRespondTrust}
          />
        )}
      </Show>
    </section>
  );
}
