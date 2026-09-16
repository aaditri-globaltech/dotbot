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

function statusLabel(session: AgentSessionSummary) {
  if (session.status === "waiting") return "Waiting for feedback";
  if (session.status === "running") return "Working…";
  if (session.status === "starting") return "Starting assistant…";
  if (session.status === "error") return "Error";
  return session.status === "ready" ? "Ready" : "Idle";
}

/** Keep the latest transcript window responsive; older items load on demand. */
const MAX_HISTORY_ITEMS = 80;

function ToolOutput({ tool }: { tool: AgentToolCall }) {
  const output = toolOutput(tool);
  const language = toolOutputLanguage(tool);
  const lineNumberStart = tool.name === "read" ? readToolOffset(tool) : 1;
  const scroll = useAutoScroll<HTMLElement>(output);
  return (
    <CodeHighlight
      code={output}
      language={language}
      className={`agent-tool-output ${tool.name === "edit" ? "agent-tool-output-edit" : ""} ${tool.status === "error" ? "agent-tool-output-error" : ""}`}
      lineNumbers={
        tool.status !== "error" && ["edit", "read", "write"].includes(tool.name)
      }
      lineNumberStart={lineNumberStart}
      setElement={scroll.setElement}
      onScroll={scroll.onScroll}
    />
  );
}

function ChatItem({ item, cwd }: { item: AgentChatItem; cwd: string }) {
  if (isErrorNotice(item)) {
    return (
      <div className="agent-error-notice" role="alert">
        {item.text}
      </div>
    );
  }

  if (isThinking(item)) {
    return (
      <div className="agent-thinking">
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
      <details
        className={`agent-tool-call agent-tool-call-${tool.status}`}
        open={tool.name !== "read"}
      >
        <summary
          ref={(element) => {
            if (element && tool.name === "bash") element.scrollTop = 0;
          }}
          className="agent-tool-command"
        >
          {showPrompt && <span className="agent-tool-prompt">$</span>}
          {showToolName && <span className="agent-tool-name">{tool.name}</span>}
          {argument && (
            <span className="agent-tool-command-label">
              <span className="agent-tool-path">
                {tool.name === "read" && path ? path : argument}
              </span>
              {tool.name === "read" && range && (
                <span className="agent-tool-range">{range}</span>
              )}
            </span>
          )}
          <span
            className={`agent-status-dot agent-tool-status-dot agent-status-dot-${toolStatusColor(tool.status)}`}
            role="img"
            dotbot-label={`Tool ${toolStatusText(tool.status)}`}
            title={`Tool ${toolStatusText(tool.status)}`}
          />
        </summary>
        {toolOutput(tool) && <ToolOutput tool={tool} />}
      </details>
    );
  }

  return (
    <article className={`agent-message agent-message-${item.role}`}>
      <div className="agent-message-text">
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

  return (
    <div className="agent-feedback-backdrop">
      <section className="agent-feedback" role="dialog" dotbot-modal="true">
        <div className="agent-feedback-title">{props.request.title}</div>
        {props.request.method === "select" && (
          <>
            <select
              className="agent-feedback-select"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {props.request.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="agent-feedback-actions">
              <button type="button" onClick={cancel}>
                Cancel
              </button>
              <button
                className="agent-feedback-primary"
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
        {props.request.method === "confirm" && (
          <>
            <p className="agent-feedback-message">{props.request.message}</p>
            <div className="agent-feedback-actions">
              <button type="button" onClick={cancel}>
                Cancel
              </button>
              <button
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
                className="agent-feedback-primary"
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
              className="agent-feedback-input"
              rows={props.request.method === "editor" ? 8 : 3}
              placeholder={
                props.request.method === "input"
                  ? props.request.placeholder
                  : undefined
              }
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <div className="agent-feedback-actions">
              <button type="button" onClick={cancel}>
                Cancel
              </button>
              <button
                className="agent-feedback-primary"
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

  return (
    <section id="view" className="panel view-panel agent-view">
      <div className="agent-view-tabs">
        {props.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`agent-view-tab ${tab.id === props.selectedSession?.id ? "is-active" : ""}`}
          >
            <button type="button" onClick={() => props.onSelectTab(tab.id)}>
              <span
                className={`agent-status-dot agent-status-dot-${tab.status}`}
              />
              <span>{tab.name ?? tab.title}</span>
            </button>
            <button
              className="agent-view-tab-close"
              type="button"
              dotbot-label={`Close ${tab.name ?? tab.title}`}
              onClick={() => props.onCloseTab(tab.id)}
            >
              <span className="codicon codicon-close" dotbot-hidden="true" />
            </button>
          </div>
        ))}
        <button
          className="agent-view-new-tab"
          type="button"
          dotbot-label="New session"
          title="New session"
          onClick={props.onNewSession}
        >
          <span className="codicon codicon-add" dotbot-hidden="true" />
        </button>
      </div>

      {props.selectedSession &&
      props.state &&
      props.selectedSession.status !== "starting" ? (
        <>
          <div className="agent-view-toolbar">
            <div className="agent-view-session-title">
              <strong>
                {props.selectedSession.name ?? props.selectedSession.title}
              </strong>
              <span title={props.selectedSession.cwd}>
                {props.selectedSession.cwd}
              </span>
            </div>
            <div className="agent-view-controls">
              <select
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
                className={`agent-view-status agent-view-status-${props.selectedSession.status}`}
              >
                {sessionStatus}
              </span>
              {props.selectedSession.status === "running" && (
                <button
                  className="agent-stop"
                  type="button"
                  onClick={props.onAbort}
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          <div className="agent-message-scroll-area">
            <div
              ref={messageScroll.setElement}
              className="agent-view-messages"
              onScroll={messageScroll.onScroll}
            >
              {messages.length === 0 ? (
                <p className="agent-empty">
                  Ask the assistant to work on this project.
                </p>
              ) : (
                <>
                  {historyWindow.older > 0 && (
                    <button
                      className="agent-history-load"
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
                className="agent-scroll-latest"
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

          <div className="agent-view-composer">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <textarea
                className="agent-input"
                dotbot-label="Message assistant"
                placeholder="Ask assistant…"
                rows={3}
                value={draft}
                disabled={inputDisabled}
                onChange={(event) => props.onDraft(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="agent-composer-footer">
                {running && (
                  <label className="agent-streaming-mode">
                    <span>Send as</span>
                    <select
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
                <span className="agent-hint">
                  {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.submit)} sends ·{" "}
                  {formatKeybinding(DEFAULT_EDITOR_KEYBINDINGS.newline)} adds a
                  line
                </span>
                <button
                  className="agent-submit"
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
        <div className="agent-view-empty">
          {props.selectedSession
            ? "Starting assistant…"
            : "Select a session to open its stream."}
        </div>
      )}
    </section>
  );
}
