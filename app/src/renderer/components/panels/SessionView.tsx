/** Render the normalized chat stream, controls, and extension dialog. */

import type {
  ExtensionRequest,
  ExtensionResponse,
  ModelSummary,
  ModelThinkingLevel,
  SessionSummary,
  StreamingBehavior,
  ToolCall,
  TranscriptItem,
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
import { projectName } from "../../project-name";
import { ChatMarkdown, MarkdownText } from "./ChatMarkdown";
import { CodeHighlight } from "./CodeHighlight";
import { Dropdown } from "./Dropdown";
import { Hero } from "./Hero";
import {
  isErrorNotice,
  isThinking,
  isToolCall,
  modelKey,
  type SessionClientState,
} from "./session-state";
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

/** Composer and extension-dialog controls. */
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

function ToolOutput({ tool }: { tool: ToolCall }) {
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

function ChatItem({
  item,
  projectDir,
}: {
  item: TranscriptItem;
  projectDir: string;
}) {
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
    const path =
      tool.name === "bash" ? bashCommand(tool) : toolPath(tool, projectDir);
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
function ExtensionDialog(props: {
  request: ExtensionRequest;
  onRespond: (response: ExtensionResponse) => void;
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
export type SessionViewProps = {
  selectedSession?: SessionSummary;
  state?: SessionClientState;
  /** Whether the composer shows the new session draft instead of a session. */
  drafting: boolean;
  /** Projects offered by the composer's project menu. */
  projects: string[];
  /** Project the selected session or newSession runs in. */
  projectDir?: string;
  onSelectProject: (projectDir: string) => void;
  onDraft: (value: string) => void;
  onPrompt: (message: string, streamingBehavior?: StreamingBehavior) => void;
  onAbort: () => void;
  onSetModel: (provider: string, modelId: string) => void;
  onSetThinkingLevel: (level: ModelThinkingLevel) => void;
  onRespond: (response: ExtensionResponse) => void;
};

/** Render session tabs, transcript controls, and the prompt composer. */
export function SessionView(props: SessionViewProps) {
  const status = props.selectedSession?.status;
  const gitStatus = useGitStatus(props.projectDir);
  // Only a real repository has a branch to show next to the project.
  const branch = gitStatus?.repoRoot ? gitStatus.branch : undefined;
  const busy =
    status === "starting" || status === "running" || status === "waiting";
  const running = status === "running";
  const inputDisabled = status === "waiting";
  const extensionRequest = props.selectedSession?.waiting;
  const [streamingBehavior, setStreamingBehavior] =
    useState<StreamingBehavior>("steer");
  const [transcriptPages, setTranscriptPages] = useState<
    Record<string, number>
  >({});
  const transcript = props.state?.transcript ?? [];
  const sessionId = props.selectedSession?.id;
  const pages = sessionId ? (transcriptPages[sessionId] ?? 0) : 0;
  const start = Math.max(
    0,
    transcript.length - MAX_TRANSCRIPT_ITEMS * (pages + 1),
  );
  const transcriptWindow = {
    transcript: transcript.slice(start),
    older: start,
  };
  const loadOlderItems = () => {
    const id = props.selectedSession?.id;
    if (!id) return;
    setTranscriptPages((current) => ({
      ...current,
      [id]: (current[id] ?? 0) + 1,
    }));
  };
  const messageScroll = useAutoScroll<HTMLElement>(
    props.state?.transcript,
    props.selectedSession?.id,
  );
  // The composer only renders for a session or the newSession, both of which have state.
  const composerState =
    props.drafting || props.selectedSession ? props.state : undefined;

  const send = (draft: string) => {
    // Running turns can be steered or queued; idle turns always start normally.
    const message = draft.trim();
    if (message && !inputDisabled) {
      props.onPrompt(message, running ? streamingBehavior : undefined);
    }
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
    draft: string,
  ) => {
    if (
      !matchesKey(event.nativeEvent, DEFAULT_EDITOR_KEYBINDINGS.submit) ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    send(draft);
  };

  const selectModel = (value: string) => {
    // Select values are provider/modelId pairs produced by modelKey().
    const separator = value.indexOf("/");
    if (separator === -1) return;
    props.onSetModel(value.slice(0, separator), value.slice(separator + 1));
  };

  const selectThinkingLevel = (level: ModelThinkingLevel) =>
    props.onSetThinkingLevel(level);

  return (
    <section
      id="view"
      className="panel view-panel relative flex flex-col overflow-hidden bg-surface"
    >
      {props.drafting ? (
        <Hero
          title={`Start a session in ${projectName(props.projectDir ?? "")}`}
          hint="Describe what you want help with."
        />
      ) : props.selectedSession &&
        props.state &&
        props.selectedSession.status !== "starting" ? (
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={messageScroll.setElement}
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
            onScroll={messageScroll.onScroll}
          >
            {transcript.length === 0 ? (
              <Hero
                title={`Start a session in ${projectName(props.projectDir ?? "")}`}
                hint="Describe what you want help with."
              />
            ) : (
              <>
                {transcriptWindow.older > 0 && (
                  <button
                    className="cursor-pointer self-center rounded-md border border-border-strong bg-card px-2.5 py-1 text-[11px] text-muted hover:border-focus hover:text-secondary"
                    type="button"
                    onClick={loadOlderItems}
                  >
                    Load older items
                  </button>
                )}
                {transcriptWindow.transcript.map((item) => (
                  <ChatItem
                    key={item.id}
                    item={item}
                    projectDir={props.selectedSession?.projectDir ?? ""}
                  />
                ))}
              </>
            )}
          </div>
          {!messageScroll.isFollowing && transcript.length > 0 && (
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
      ) : props.selectedSession ? (
        <div className="grid flex-1 place-items-center text-xs text-dim">
          Starting session…
        </div>
      ) : (
        <Hero
          title="No session open"
          hint="Pick one from the sidebar, or start a new session."
        />
      )}

      {composerState && (
        <div className="shrink-0 px-5 pt-1.5 pb-4">
          <form
            className="mx-auto w-full max-w-[740px] rounded-2xl bg-card px-4 pt-3 pb-2.5 transition-colors focus-within:ring-1 focus-within:ring-border-strong"
            onSubmit={(event) => {
              event.preventDefault();
              send(composerState.draft);
            }}
          >
            {/* Project and branch a session runs against, before one exists. */}
            {props.drafting && (
              <div className="mb-2 flex min-w-0 items-center gap-1.5 text-[12px] text-secondary">
                <Dropdown
                  label="Project"
                  icon="codicon-folder"
                  value={props.projectDir ?? ""}
                  onChange={props.onSelectProject}
                  placement="up"
                  className="max-w-[200px]"
                  options={props.projects.map((projectDir) => ({
                    value: projectDir,
                    label: projectName(projectDir),
                    description: projectDir,
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
            )}
            <textarea
              className="block field-sizing-content max-h-[220px] min-h-[52px] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[13px] leading-[1.5] text-secondary outline-0 placeholder:text-faint focus:outline-none disabled:opacity-60"
              dotbot-label="Send message"
              placeholder="Ask Dotbot…"
              rows={3}
              value={composerState.draft}
              disabled={inputDisabled}
              onChange={(event) => props.onDraft(event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, composerState.draft)}
            />
            <div className="mt-1.5 flex items-center gap-1.5">
              {props.selectedSession && (
                <span
                  className={`shrink-0 text-[11px] whitespace-nowrap ${statusTextClass(props.selectedSession.status)}`}
                >
                  {statusLabel(props.selectedSession)}
                </span>
              )}
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
                value={composerState.selectedModel}
                placement="up"
                align="right"
                placeholder={
                  composerState.models.length === 0
                    ? "Loading models…"
                    : undefined
                }
                disabled={busy || composerState.models.length === 0}
                onChange={selectModel}
                options={composerState.models.map((model: ModelSummary) => ({
                  value: modelKey(model),
                  label: model.name,
                  description: model.provider,
                }))}
              />
              <Dropdown
                label="Thinking level"
                icon="codicon-lightbulb"
                value={composerState.thinkingLevel}
                placement="up"
                align="right"
                placeholder={
                  composerState.thinkingLevels.length === 0
                    ? "Loading levels…"
                    : undefined
                }
                disabled={busy || composerState.thinkingLevels.length === 0}
                onChange={selectThinkingLevel}
                options={composerState.thinkingLevels.map((level) => ({
                  value: level,
                  label: level,
                }))}
              />
              <button
                className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-app disabled:cursor-default disabled:bg-elevated disabled:text-dim"
                type="submit"
                dotbot-label="Send message"
                title="Send message"
                disabled={inputDisabled || !composerState.draft.trim()}
              >
                <span
                  className="codicon codicon-arrow-up text-[13px]"
                  dotbot-hidden="true"
                />
              </button>
            </div>
          </form>
        </div>
      )}
      {extensionRequest && (
        <ExtensionDialog
          request={extensionRequest}
          onRespond={props.onRespond}
        />
      )}
    </section>
  );
}
