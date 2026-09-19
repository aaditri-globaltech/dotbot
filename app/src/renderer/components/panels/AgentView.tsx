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
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { useGitStatus } from "../../hooks/useGitStatus";
import {
  DEFAULT_EDITOR_KEYBINDINGS,
  formatKeybinding,
  matchesKey,
} from "../../keybindings";
import { workspaceName } from "../../workspace-name";
import {
  isErrorNotice,
  isThinking,
  isToolCall,
  modelKey,
  type SessionClientState,
} from "./agent-session-state";
import { ChatMarkdown, MarkdownText } from "./ChatMarkdown";
import { CodeHighlight } from "./CodeHighlight";
import { Dropdown } from "./Dropdown";
import { Hero } from "./Hero";
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
  "block w-full rounded-md border border-border-strong bg-surface " +
  "text-secondary outline-0 focus:border-focus";
const CHAT_BUTTON_CLASS =
  "min-w-[52px] cursor-pointer rounded-md border border-border-strong " +
  "bg-control px-2.5 py-1 text-[11px] text-secondary hover:border-focus " +
  "hover:bg-border-strong";
/** Light primary action, matching the reference's call-to-action buttons. */
const PRIMARY_BUTTON_CLASS =
  "min-w-[52px] cursor-pointer rounded-md border border-transparent " +
  "bg-secondary px-2.5 py-1 text-[11px] text-app hover:bg-primary";

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

  // Every method answers with Cancel plus its own choice, so the row is shared.
  const actions = (choice: ReactNode) => (
    <div className="mt-3.5 flex justify-end gap-1.5">
      <button className={CHAT_BUTTON_CLASS} type="button" onClick={cancel}>
        Cancel
      </button>
      {choice}
    </div>
  );

  const continueWithValue = (
    <button
      className={PRIMARY_BUTTON_CLASS}
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
  );

  return (
    <div className="absolute inset-0 z-5 grid place-items-center bg-black/45 p-5">
      <section
        className="w-[min(440px,100%)] rounded-lg border border-border-strong bg-card p-4 shadow-card"
        role="dialog"
        dotbot-modal="true"
      >
        <div className="mb-3 text-[13px] font-semibold text-secondary">
          {props.request.title}
        </div>
        {props.request.method === "select" && (
          <>
            <Dropdown
              label={props.request.title}
              value={value}
              options={props.request.options.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={setValue}
              variant="field"
            />
            {actions(continueWithValue)}
          </>
        )}
        {props.request.method === "confirm" && (
          <>
            <p className="mt-0 mr-0 mb-3.5 ml-0 text-xs leading-normal text-muted [white-space:pre-wrap]">
              {props.request.message}
            </p>
            {actions(
              <>
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
                  className={PRIMARY_BUTTON_CLASS}
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
              </>,
            )}
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
            {actions(continueWithValue)}
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
  /** Workspaces offered by the composer's project menu. */
  workspaces: string[];
  /** Workspace the selected session runs in. */
  workspaceCwd?: string;
  onSelectWorkspace: (cwd: string) => void;
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
  const gitStatus = useGitStatus(props.workspaceCwd);
  // Only a real repository has a branch to show next to the project.
  const branch = gitStatus?.root ? gitStatus.branch : undefined;
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

  const selectThinkingLevel = (level: AgentThinkingLevel) =>
    props.onCommand({ type: "set_thinking_level", level });

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
          dotbot-label="New task"
          title="New task"
          onClick={props.onNewSession}
        >
          <span className="codicon codicon-add text-xs" dotbot-hidden="true" />
        </button>
      </div>

      {props.selectedSession &&
      props.state &&
      props.selectedSession.status !== "starting" ? (
        <>
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div
              ref={messageScroll.setElement}
              className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
              onScroll={messageScroll.onScroll}
            >
              {messages.length === 0 ? (
                <Hero
                  title={`Start a task in ${workspaceName(props.workspaceCwd ?? "")}`}
                  hint="Describe the change, question, or task you want help with."
                />
              ) : (
                <>
                  {historyWindow.older > 0 && (
                    <button
                      className="cursor-pointer self-center rounded-md border border-border-strong bg-card px-2.5 py-1 text-[11px] text-muted hover:border-focus hover:text-secondary"
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

          <div className="shrink-0 px-5 pt-1.5 pb-4">
            <form
              className="mx-auto w-full max-w-[740px] rounded-2xl bg-card px-4 pt-3 pb-2.5 transition-colors focus-within:ring-1 focus-within:ring-border-strong"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              {/* Project and branch the task runs against, as in the reference composer. */}
              <div className="mb-2 flex min-w-0 items-center gap-1.5 text-[12px] text-secondary">
                <Dropdown
                  label="Project"
                  icon="codicon-folder"
                  value={props.workspaceCwd ?? ""}
                  onChange={props.onSelectWorkspace}
                  placement="up"
                  className="max-w-[200px]"
                  options={[
                    ...(props.workspaceCwd &&
                    !props.workspaces.includes(props.workspaceCwd)
                      ? [props.workspaceCwd]
                      : []),
                    ...props.workspaces,
                  ].map((workspace) => ({
                    value: workspace,
                    label: workspaceName(workspace),
                    description: workspace,
                  }))}
                />
                {branch && (
                  <>
                    <span
                      className="codicon codicon-git-branch ml-1 shrink-0 text-[13px] text-dim"
                      dotbot-hidden="true"
                    />
                    <span className="min-w-0 truncate text-muted">
                      {branch}
                    </span>
                  </>
                )}
              </div>
              <textarea
                className="block field-sizing-content max-h-[220px] min-h-[52px] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[13px] leading-[1.5] text-secondary outline-0 placeholder:text-faint focus:outline-none disabled:opacity-60"
                dotbot-label="Message assistant"
                placeholder="Ask Dotbot…"
                rows={3}
                value={draft}
                disabled={inputDisabled}
                onChange={(event) => props.onDraft(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={`shrink-0 text-[11px] whitespace-nowrap ${statusTextClass(props.selectedSession.status)}`}
                >
                  {sessionStatus}
                </span>
                {running && (
                  <button
                    className={`${CHAT_BUTTON_CLASS} shrink-0 border-error/50 text-error`}
                    type="button"
                    onClick={props.onAbort}
                  >
                    Stop
                  </button>
                )}
                {running && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] whitespace-nowrap text-dim">
                    Send as
                    <Dropdown
                      label="Streaming behavior"
                      value={streamingBehavior}
                      placement="up"
                      align="right"
                      onChange={setStreamingBehavior}
                      options={[
                        { value: "steer", label: "Steer" },
                        { value: "followUp", label: "Follow up" },
                      ]}
                    />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] text-faint">
                  {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.submit)} sends ·{" "}
                  {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.newline)} adds a
                  line
                </span>
                <Dropdown
                  label="Model"
                  value={props.state.selectedModel}
                  placement="up"
                  align="right"
                  placeholder={
                    props.state.models.length === 0
                      ? "Loading models…"
                      : undefined
                  }
                  disabled={busy || props.state.models.length === 0}
                  onChange={selectModel}
                  options={props.state.models.map((model: AgentModel) => ({
                    value: modelKey(model),
                    label: model.name,
                    description: model.provider,
                  }))}
                />
                <Dropdown
                  label="Thinking level"
                  icon="codicon-lightbulb"
                  value={props.state.thinkingLevel}
                  placement="up"
                  align="right"
                  placeholder={
                    props.state.thinkingLevels.length === 0
                      ? "Loading levels…"
                      : undefined
                  }
                  disabled={busy || props.state.thinkingLevels.length === 0}
                  onChange={selectThinkingLevel}
                  options={props.state.thinkingLevels.map((level) => ({
                    value: level,
                    label: level,
                  }))}
                />
                <button
                  className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-app disabled:cursor-default disabled:bg-elevated disabled:text-dim"
                  type="submit"
                  dotbot-label="Send message"
                  title="Send message"
                  disabled={inputDisabled || !draft.trim()}
                >
                  <span
                    className="codicon codicon-arrow-up text-[13px]"
                    dotbot-hidden="true"
                  />
                </button>
              </div>
            </form>
          </div>
          {feedback && (
            <FeedbackDialog request={feedback} onRespond={props.onRespond} />
          )}
        </>
      ) : props.selectedSession ? (
        <div className="grid flex-1 place-items-center text-xs text-dim">
          Starting assistant…
        </div>
      ) : (
        <Hero
          title="No task open"
          hint="Pick one from the sidebar, or start a new task."
        />
      )}
    </section>
  );
}
