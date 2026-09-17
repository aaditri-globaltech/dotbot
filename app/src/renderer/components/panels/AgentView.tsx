/** Render the normalized chat stream, controls, and extension feedback dialog. */

import type {
  AgentChatItem,
  AgentCommand,
  AgentFeedbackRequest,
  AgentFeedbackResponse,
  AgentModel,
  AgentSessionSummary,
  AgentStreamingBehavior,
  AgentThinkingLevel,
  AgentToolCall,
} from "@dotbot/agent-core";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useState,
} from "react";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import {
  DEFAULT_EDITOR_KEYBINDINGS,
  formatKeybinding,
  matchesKey,
} from "../../keybindings";
import {
  isErrorNotice,
  isThinking,
  isToolCall,
  modelKey,
  type SessionClientState,
} from "./agent-session-state";
import { ChatMarkdown, MarkdownText } from "./ChatMarkdown";
import { CodeHighlight } from "./CodeHighlight";
import { statusDotClass } from "./status-dot";
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

/** Mono type scale shared by tool cards. */
const MONO_TEXT = "font-mono text-xs leading-[1.45]";

/** Message bubble shared by user and assistant turns. */
const MESSAGE_CLASS =
  "max-w-full text-sm leading-normal [overflow-wrap:anywhere] " +
  "[white-space:pre-wrap]";

/** Tool card frame and its collapsible command row. */
const TOOL_CALL_CLASS =
  "group self-start w-[95%] max-w-[95%] min-w-0 rounded border " +
  `border-border bg-surface ${MONO_TEXT}`;
const TOOL_COMMAND_CLASS =
  "flex cursor-pointer list-none items-start gap-2 px-2 py-[7px] " +
  "select-none [overflow-wrap:anywhere] hover:bg-input focus-visible:ring-1 " +
  "focus-visible:ring-focus before:flex-none before:text-dim " +
  "before:content-['▸'] group-open:before:content-['▾']";

/** Composer and feedback-dialog controls. */
const CHAT_INPUT_CLASS =
  "block w-full rounded-[3px] border border-border-strong bg-surface " +
  "text-secondary outline-0 focus:border-focus";
const CHAT_BUTTON_CLASS =
  "min-w-[52px] cursor-pointer rounded-[3px] border border-border-strong " +
  "bg-control px-2.5 py-1 text-[11px] text-secondary hover:border-focus " +
  "hover:bg-border-strong";

function statusLabel(session: AgentSessionSummary) {
  if (session.status === "waiting") return "Waiting for feedback";
  if (session.status === "running") return "Working…";
  if (session.status === "starting") return "Starting assistant…";
  if (session.status === "error") return "Error";
  return session.status === "ready" ? "Ready" : "Idle";
}

/** Status text color, so waiting and failures stand out from idle. */
function statusTextClass(status: AgentSessionSummary["status"]) {
  if (status === "waiting") return "text-warning";
  if (status === "error") return "text-error";
  return "text-dim";
}

/** Keep the latest transcript window responsive; older items load on demand. */
const MAX_HISTORY_ITEMS = 80;

/** Diff markers and line numbers hidden when a tool card shows an edit. */
const EDIT_OUTPUT_CLASS =
  "text-muted [&_[data-line-number]]:hidden [&_.hljs-addition]:px-px " +
  "[&_.hljs-addition]:bg-[#243a29] [&_.hljs-addition]:text-[#9cdc9c] " +
  "[&_.hljs-deletion]:px-px [&_.hljs-deletion]:bg-[#3a2424] " +
  "[&_.hljs-deletion]:text-[#d49a92]";

function ToolOutput({ tool }: { tool: AgentToolCall }) {
  const output = toolOutput(tool);
  const language = toolOutputLanguage(tool);
  const lineNumberStart = tool.name === "read" ? readToolOffset(tool) : 1;
  const scroll = useAutoScroll<HTMLElement>(output);
  const failure = tool.status === "error";
  const outputClass = failure
    ? "max-h-[234px] overflow-auto px-3 py-[7px] text-error " +
      "[overflow-wrap:anywhere] [white-space:pre-wrap]"
    : "max-h-[234px] overflow-auto px-3 py-[7px] " +
      "[overflow-wrap:anywhere] [white-space:pre-wrap]";
  return (
    <CodeHighlight
      code={output}
      language={language}
      className={`${outputClass} ${tool.name === "edit" ? EDIT_OUTPUT_CLASS : ""}`}
      lineNumbers={!failure && ["edit", "read", "write"].includes(tool.name)}
      lineNumberStart={lineNumberStart}
      setElement={scroll.setElement}
      onScroll={scroll.onScroll}
    />
  );
}

function ChatItem({ item, cwd }: { item: AgentChatItem; cwd: string }) {
  if (isErrorNotice(item)) {
    return (
      <div
        className="max-w-full self-start rounded border border-error/35 bg-error/10 px-2.5 py-1.5 text-[13px] leading-[1.45] text-error [overflow-wrap:anywhere] [white-space:pre-wrap]"
        role="alert"
      >
        {item.text}
      </div>
    );
  }

  if (isThinking(item)) {
    return (
      <div className="max-w-full self-start px-2 text-[13px] leading-[1.45] text-muted italic [overflow-wrap:anywhere] [white-space:pre-wrap]">
        <MarkdownText text={item.text} />
      </div>
    );
  }

  if (isToolCall(item)) {
    const tool = item;
    const path = tool.name === "bash" ? bashCommand(tool) : toolPath(tool, cwd);
    const range = tool.name === "read" ? readToolRange(tool) : "";
    const argument =
      tool.name === "bash"
        ? bashCommand(tool)
        : path
          ? `${path}${range}`
          : undefined;
    const showPrompt =
      tool.name === "bash" || !["read", "edit", "write"].includes(tool.name);
    const showToolName = tool.name !== "bash" || argument === undefined;
    return (
      <details className={TOOL_CALL_CLASS} open={tool.name !== "read"}>
        <summary
          ref={(element) => {
            if (element && tool.name === "bash") element.scrollTop = 0;
          }}
          className={`${TOOL_COMMAND_CLASS} ${
            tool.name === "bash"
              ? "max-h-[calc(4*1.45em+14px)] overflow-x-hidden overflow-y-auto [overflow-anchor:none] [overscroll-behavior:auto]"
              : ""
          }`}
        >
          {showPrompt && (
            <span className="shrink-0 font-semibold text-secondary">$</span>
          )}
          {showToolName && (
            <span className="shrink-0 font-semibold whitespace-nowrap text-code">
              {tool.name}
            </span>
          )}
          {argument && (
            <span className="flex min-w-0 flex-1 [overflow-wrap:break-word]">
              <span className="min-w-0 flex-1 [overflow-wrap:break-word]">
                {tool.name === "read" && path ? path : argument}
              </span>
              {tool.name === "read" && range && (
                <span className="ml-1 shrink-0 text-[10px] font-semibold whitespace-nowrap text-code">
                  {range}
                </span>
              )}
            </span>
          )}
          <span
            className={`${statusDotClass(toolStatusColor(tool.status))} mt-[5px] ml-auto`}
            role="img"
            dotbot-label={`Tool ${toolStatusText(tool.status)}`}
            title={`Tool ${toolStatusText(tool.status)}`}
          />
        </summary>
        {toolOutput(tool) && <ToolOutput tool={tool} />}
      </details>
    );
  }

  const roleClass =
    item.role === "user"
      ? "self-end max-w-[min(80%,720px)] rounded border border-border bg-input px-2.5 py-2 [white-space:normal]"
      : "self-start px-2";
  return (
    <article className={`${MESSAGE_CLASS} ${roleClass}`}>
      <div className="min-w-0">
        <ChatMarkdown text={item.text} />
      </div>
    </article>
  );
}

/** Adapt the agent's extension request contract to native form controls. */
function FeedbackDialog(props: {
  request: AgentFeedbackRequest;
  onRespond: (response: AgentFeedbackResponse) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const request = props.request;
    setValue(
      request.method === "editor"
        ? (request.prefill ?? "")
        : request.method === "select"
          ? (request.options[0] ?? "")
          : "",
    );
  }, [props.request]);

  const cancel = () =>
    props.onRespond({
      type: "extension_ui_response",
      id: props.request.id,
      cancelled: true,
    });

  const actions = (
    <div className="mt-3.5 flex justify-end gap-1.5">
      <button className={CHAT_BUTTON_CLASS} type="button" onClick={cancel}>
        Cancel
      </button>
      {props.request.method === "select" && (
        <button
          className={`${CHAT_BUTTON_CLASS} border-focus bg-[#264f78]`}
          type="button"
          onClick={() =>
            props.onRespond({
              type: "extension_ui_response",
              id: props.request.id,
              value,
            })
          }
        >
          Continue
        </button>
      )}
    </div>
  );

  return (
    <div className="absolute inset-0 z-5 grid place-items-center bg-black/45 p-5">
      <section
        className="w-[min(440px,100%)] rounded-[5px] border border-border-strong bg-card p-4 shadow-[0_8px_30px_rgb(0_0_0/35%)]"
        role="dialog"
        dotbot-modal="true"
      >
        <div className="mb-3 text-[13px] font-semibold text-secondary">
          {props.request.title}
        </div>
        {props.request.method === "select" && (
          <>
            <select
              className={`${CHAT_INPUT_CLASS} p-1.5 text-xs`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {props.request.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {actions}
          </>
        )}
        {props.request.method === "confirm" && (
          <>
            <p className="mt-0 mr-0 mb-3.5 ml-0 text-xs leading-normal text-muted [white-space:pre-wrap]">
              {props.request.message}
            </p>
            <div className="mt-3.5 flex justify-end gap-1.5">
              <button
                className={CHAT_BUTTON_CLASS}
                type="button"
                onClick={cancel}
              >
                Cancel
              </button>
              <button
                className={CHAT_BUTTON_CLASS}
                type="button"
                onClick={() =>
                  props.onRespond({
                    type: "extension_ui_response",
                    id: props.request.id,
                    confirmed: false,
                  })
                }
              >
                No
              </button>
              <button
                className={`${CHAT_BUTTON_CLASS} border-focus bg-[#264f78]`}
                type="button"
                onClick={() =>
                  props.onRespond({
                    type: "extension_ui_response",
                    id: props.request.id,
                    confirmed: true,
                  })
                }
              >
                Yes
              </button>
            </div>
          </>
        )}
        {(props.request.method === "input" ||
          props.request.method === "editor") && (
          <>
            <textarea
              className={`${CHAT_INPUT_CLASS} resize-y p-1.5 text-xs leading-[1.4]`}
              rows={props.request.method === "editor" ? 8 : 3}
              placeholder={
                props.request.method === "input"
                  ? props.request.placeholder
                  : undefined
              }
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <div className="mt-3.5 flex justify-end gap-1.5">
              <button
                className={CHAT_BUTTON_CLASS}
                type="button"
                onClick={cancel}
              >
                Cancel
              </button>
              <button
                className={`${CHAT_BUTTON_CLASS} border-focus bg-[#264f78]`}
                type="button"
                onClick={() =>
                  props.onRespond({
                    type: "extension_ui_response",
                    id: props.request.id,
                    value,
                  })
                }
              >
                Continue
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** Inputs for the selected Agent transcript and controls. */
export type AgentViewProps = {
  tabs: AgentSessionSummary[];
  selectedSession?: AgentSessionSummary;
  state?: SessionClientState;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewSession: () => void;
  onDraft: (value: string) => void;
  onPrompt: (
    message: string,
    streamingBehavior?: AgentStreamingBehavior,
  ) => void;
  onAbort: () => void;
  onCommand: (command: AgentCommand) => void;
  onRespond: (response: AgentFeedbackResponse) => void;
};

/** Render session tabs, transcript controls, and the prompt composer. */
export function AgentView(props: AgentViewProps) {
  const status = props.selectedSession?.status;
  const busy =
    status === "starting" || status === "running" || status === "waiting";
  const running = status === "running";
  const inputDisabled = status === "starting" || status === "waiting";
  const draft = props.state?.draft ?? "";
  const feedback = props.selectedSession?.waiting;
  const sessionStatus = props.selectedSession
    ? statusLabel(props.selectedSession)
    : "";
  const [streamingBehavior, setStreamingBehavior] =
    useState<AgentStreamingBehavior>("steer");
  const [historyPages, setHistoryPages] = useState<Record<string, number>>({});
  const messages = props.state?.messages ?? [];
  const sessionId = props.selectedSession?.id;
  const pages = sessionId ? (historyPages[sessionId] ?? 0) : 0;
  const start = Math.max(0, messages.length - MAX_HISTORY_ITEMS * (pages + 1));
  const historyWindow = { messages: messages.slice(start), older: start };
  const loadOlderMessages = () => {
    const id = props.selectedSession?.id;
    if (!id) return;
    setHistoryPages((current) => ({
      ...current,
      [id]: (current[id] ?? 0) + 1,
    }));
  };
  const messageScroll = useAutoScroll<HTMLElement>(
    props.state?.messages,
    props.selectedSession?.id,
  );

  const send = () => {
    // Running turns can be steered or queued; idle turns always start normally.
    const message = draft.trim();
    if (message && !inputDisabled) {
      props.onPrompt(message, running ? streamingBehavior : undefined);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !matchesKey(event.nativeEvent, DEFAULT_EDITOR_KEYBINDINGS.submit) ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    send();
  };

  const selectModel = (value: string) => {
    // Select values are provider/modelId pairs produced by modelKey().
    const separator = value.indexOf("/");
    if (separator === -1) return;
    props.onCommand({
      type: "set_model",
      provider: value.slice(0, separator),
      modelId: value.slice(separator + 1),
    });
  };

  const selectThinkingLevel = (value: string) => {
    if (
      value !== "off" &&
      value !== "minimal" &&
      value !== "low" &&
      value !== "medium" &&
      value !== "high" &&
      value !== "xhigh" &&
      value !== "max"
    ) {
      return;
    }
    props.onCommand({
      type: "set_thinking_level",
      level: value as AgentThinkingLevel,
    });
  };

  const controlSelectClass =
    "max-w-[170px] rounded-[3px] border border-border-strong bg-surface " +
    "px-1 py-[3px] text-[11px] text-secondary focus:border-focus " +
    "focus:outline-none disabled:opacity-55";

  return (
    <section
      id="view"
      className="panel view-panel relative flex flex-col overflow-hidden bg-surface"
    >
      <div className="flex min-h-[35px] shrink-0 items-stretch overflow-x-auto border-b border-border bg-app">
        {props.tabs.map((tab) => {
          const active = tab.id === props.selectedSession?.id;
          return (
            <div
              key={tab.id}
              className="flex max-w-[220px] shrink-0 items-stretch border-r border-border"
            >
              <button
                type="button"
                className={`flex min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden border-0 px-2 text-[11px] ${
                  active
                    ? "bg-surface text-secondary"
                    : "bg-transparent text-dim"
                }`}
                onClick={() => props.onSelectTab(tab.id)}
              >
                <span className={statusDotClass(tab.status)} />
                <span className="truncate">{tab.name ?? tab.title}</span>
              </button>
              <button
                className="grid size-[26px] shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-dim hover:bg-border hover:text-primary"
                type="button"
                dotbot-label={`Close ${tab.name ?? tab.title}`}
                onClick={() => props.onCloseTab(tab.id)}
              >
                <span
                  className="codicon codicon-close text-xs"
                  dotbot-hidden="true"
                />
              </button>
            </div>
          );
        })}
        <button
          className="grid size-[26px] shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-dim hover:bg-border hover:text-primary"
          type="button"
          dotbot-label="New session"
          title="New session"
          onClick={props.onNewSession}
        >
          <span className="codicon codicon-add text-xs" dotbot-hidden="true" />
        </button>
      </div>

      {props.selectedSession &&
      props.state &&
      props.selectedSession.status !== "starting" ? (
        <>
          <div className="flex min-h-[44px] shrink-0 items-center gap-3 border-b border-border px-3 py-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong className="truncate text-xs font-medium text-secondary">
                {props.selectedSession.name ?? props.selectedSession.title}
              </strong>
              <span
                className="truncate text-[10px] text-faint"
                title={props.selectedSession.cwd}
              >
                {props.selectedSession.cwd}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                className={controlSelectClass}
                dotbot-label="Model"
                value={props.state.selectedModel}
                disabled={busy || props.state.models.length === 0}
                onChange={(event) => selectModel(event.target.value)}
              >
                {props.state.models.length === 0 && (
                  <option value="">Loading models…</option>
                )}
                {props.state.models.map((model: AgentModel) => (
                  <option key={modelKey(model)} value={modelKey(model)}>
                    {model.name}
                  </option>
                ))}
              </select>
              <select
                className={controlSelectClass}
                dotbot-label="Thinking level"
                value={props.state.thinkingLevel}
                disabled={busy || props.state.thinkingLevels.length === 0}
                onChange={(event) => selectThinkingLevel(event.target.value)}
              >
                {props.state.thinkingLevels.length === 0 && (
                  <option value="">Loading levels…</option>
                )}
                {props.state.thinkingLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <span
                className={`text-[11px] whitespace-nowrap ${statusTextClass(props.selectedSession.status)}`}
              >
                {sessionStatus}
              </span>
              {props.selectedSession.status === "running" && (
                <button
                  className={`${CHAT_BUTTON_CLASS} border-error/50 text-error`}
                  type="button"
                  onClick={props.onAbort}
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div
              ref={messageScroll.setElement}
              className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
              onScroll={messageScroll.onScroll}
            >
              {messages.length === 0 ? (
                <p className="grid flex-1 place-items-center text-xs text-dim">
                  Ask the assistant to work on this project.
                </p>
              ) : (
                <>
                  {historyWindow.older > 0 && (
                    <button
                      className="cursor-pointer self-center rounded-[3px] border border-border-strong bg-card px-2.5 py-1 text-[11px] text-muted hover:border-focus hover:text-secondary"
                      type="button"
                      onClick={loadOlderMessages}
                    >
                      Load older messages
                    </button>
                  )}
                  {historyWindow.messages.map((item) => (
                    <ChatItem
                      key={item.id}
                      item={item}
                      cwd={props.selectedSession?.cwd ?? ""}
                    />
                  ))}
                </>
              )}
            </div>
            {!messageScroll.isFollowing && messages.length > 0 && (
              <button
                className="absolute bottom-3 left-1/2 z-2 grid size-[26px] -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-border-strong bg-card text-secondary shadow-[0_2px_8px_rgb(0_0_0/35%)] hover:border-focus hover:text-primary focus-visible:ring-1 focus-visible:ring-focus focus-visible:ring-offset-2"
                type="button"
                dotbot-label="Jump to latest message"
                title="Jump to latest message"
                onClick={messageScroll.jumpToBottom}
              >
                <span
                  className="codicon codicon-chevron-down"
                  dotbot-hidden="true"
                />
              </button>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-5 py-2.5 pb-3.5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <textarea
                className="block min-h-[58px] w-full resize-y rounded-[3px] border border-border-strong bg-surface p-2 text-xs leading-[1.4] text-secondary outline-0 focus:border-focus disabled:opacity-65"
                dotbot-label="Message assistant"
                placeholder="Ask assistant…"
                rows={3}
                value={draft}
                disabled={inputDisabled}
                onChange={(event) => props.onDraft(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="mt-[7px] flex items-center gap-2">
                {running && (
                  <label className="flex items-center gap-1 text-[10px] whitespace-nowrap text-dim">
                    <span>Send as</span>
                    <select
                      className="rounded-[3px] border border-border-strong bg-surface px-1 py-0.5 text-secondary"
                      dotbot-label="Streaming behavior"
                      value={streamingBehavior}
                      onChange={(event) =>
                        setStreamingBehavior(
                          event.target.value as AgentStreamingBehavior,
                        )
                      }
                    >
                      <option value="steer">Steer</option>
                      <option value="followUp">Follow up</option>
                    </select>
                  </label>
                )}
                <span className="flex-1 truncate text-[10px] text-faint">
                  {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.submit)} sends ·{" "}
                  {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.newline)} adds a
                  line
                </span>
                <button
                  className={`${CHAT_BUTTON_CLASS} disabled:cursor-default disabled:opacity-45`}
                  type="submit"
                  disabled={inputDisabled || !draft.trim()}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
          {feedback && (
            <FeedbackDialog request={feedback} onRespond={props.onRespond} />
          )}
        </>
      ) : (
        <div className="grid flex-1 place-items-center text-xs text-dim">
          {props.selectedSession
            ? "Starting assistant…"
            : "Select a session to open its stream."}
        </div>
      )}
    </section>
  );
}
