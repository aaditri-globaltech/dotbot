# Glossary

Every term Dotbot uses, with the meaning it has in this codebase. One word per
concept: if a concept is here, use its entry in code, copy, and docs.

Terms marked **(Pi)** come from the agent runtime and keep Pi's meaning. The
rest are Dotbot's. A few Pi terms that Dotbot passes through are listed so
nothing is a surprise when reading the SDK re-exports.

## Product

**Workspace** — The set of projects a user has opened in Dotbot; the app's
top-level scope. Pi has no equivalent. In code: `workspaceStore`,
`WorkspaceState`.

**Project** — A directory opened into the workspace. A project contains
sessions. In code: `projects`, `selectedProject`, `selectProject`,
`projectName`.

**projectDir** — The absolute path of a project. App-facing payloads always use
this name (`SessionSummary.projectDir`). Pi calls the same string a `cwd` when a
session runs in it; that name appears only where Pi's API is called.

**Session** — One unit of work in a project: a conversation with the agent that
has a transcript, a status, and model and thinking choices. Backed by a Pi agent
session. In code: `SessionSummary`, `SessionStatus`, `SessionControls`,
`session-store`. Do not call it a task.

**Session tab** — A session opened in the strip above the workbench. A tab keeps
its in-process agent session while open and disposes it when closed; the
persisted session file stays, and reopening the session reloads its transcript.
In code: `tabs`, `SessionTabs`.

**New session** — The draft pane shown before a session exists. The first
keystroke creates the session, applies its model and thinking choices, and then
the first prompt starts the first turn. In code: `newSession`,
`startNewSession`, `ensureNewSession`.

**Screen** — A top-level view selected from the sidebar: Dashboard, Workbench,
or Manage. In code: `Screen`, `navigation-store`.

**Dashboard** — The home screen: the project launcher, recent sessions and
projects, and usage stats.

**Workbench** — The session screen: the transcript and composer, with the Git
panel docked below.

**Composer** — The message box at the bottom of the workbench where prompts,
bash commands, and steer or follow-up messages are typed.

**Files** — The project file tree, shown in the sidebar's files mode. In code:
`@dotbot/files`, `FileTreePanel`, `readDirectory`, `sidebarMode`.

**Git panel** — Branch, changes, staging, and commits for the active project,
shown in the workbench's bottom panel. In code: `@dotbot/git`, `GitSidebar`,
`gitStatus`. Do not call it Source Control in new text.

**Usage stats** — Dashboard aggregates computed from persisted session files:
messages, tokens, active days, streaks, peak hour, a daily heatmap, and models.
In code: `UsageStats`, `UsageStatsStore`, `UsageStatsPanel`.

**Unread** — A renderer-only marker for a session that produced events while
another session was selected.

**Trust** — The decision that lets the agent use a project's local resources:
settings, extensions, skills, prompts, themes, or system prompts. Dotbot asks
only when a project has such resources, remembers the answer, and falls back to
the global default otherwise. A one-time answer is not saved. In code:
`TrustManager`, `trust-store`, `TrustPrompt`, `trust.json`.

**Trust default** — The global fallback for projects without a saved decision:
`ask`, `always`, or `never` (`DefaultProjectTrust`). A saved project decision is
a `TrustDecisionEntry` (`{ path, decision }`); revoking one clears it so the
next session asks again.

**Trust request** — The dialog that asks a project's trust decision. Same shape
as an extension request; emitted as the `trust_request` manager event with the
answer returned through `respondTrust`.

## Agent runtime

**Agent (Pi)** — The harness plus LLM that executes a session. It is Pi itself;
Dotbot embeds it in the Electron main process.

**Agent directory (Pi)** — Pi's data directory under the user's home
directory: settings, credentials, session files, trust decisions, and custom
providers. In code: `getAgentDir`, `getSessionsDir`.

**AgentManager** — Dotbot's orchestrator for agents and sessions: it creates,
opens, prompts, aborts, and discards sessions and forwards their events. It
replaces Pi's `SessionManager` as the app-facing entry point.

**ProviderRegistry** — Owns provider credentials and custom provider entries;
lists providers and saves or removes API keys.

**Session file (Pi)** — Pi's JSONL persistence for a session under the agent
directory. Dotbot never writes it directly. In code: `SessionRecord.path`.

**Session id (Pi)** — Pi's identifier for a session. Dotbot's session id is the
same value; the duplicated `piSessionId` field was removed.

**Title, name** — `title` is Dotbot's fallback display title (the first prompt
or the file name); `name` is Pi's user-set session name. The UI shows
`name ?? title`.

**Status** — Dotbot's lifecycle state for a session: `starting`, `running`,
`waiting`, `idle`, or `error`. A session that has started but not been prompted
is `idle`.

**Turn (Pi)** — One assistant response plus the tool calls it makes.

**Prompt (Pi)** — A message sent to a session.

**Steer, Follow up (Pi)** — How a message sent during a running turn is queued:
`steer` delivers it before the next provider request, `followUp` after the turn
finishes. In code: `StreamingBehavior`.

**Streaming (Pi)** — Partial model output delivered as it arrives. A session is
streaming until the turn settles.

**Settled (Pi)** — A turn that has finished (`agent_settled`). A settled session
can be disposed when its tab closes.

**Compaction (Pi)** — Summarizing older context when a session grows too long.
The manager exposes it; the UI does not surface it yet.

**Bash mode** — A composer draft that starts with `!` or `!!` runs a shell
command instead of prompting: `!` adds the output to the model's context, `!!`
keeps it out (`excludeFromContext`). It renders as a transcript item, not a tool
call. In code: `BashExecution`, `BashExecutionView`, `runBash`,
`parseBashCommand`; the manager runs it with `executeBash` and returns
`BashResult`.

**Extension (Pi)** — A Pi extension loaded into a session; it can add tools,
commands, and UI dialogs.

**Skill, prompt template, settings, theme (Pi)** — Extension resources Pi loads
from the agent directory. Dotbot re-exports the types but does not surface them
as UI.

## Transcript

**Transcript** — The renderer's normalized view of a session's messages and tool
activity. In code: `TranscriptItem[]`, `session_transcript`.

**Transcript item** — One rendered entry: a message, a tool call, a thinking
block, a bash execution, or an error notice (`TranscriptItem = TranscriptMessage
| ToolCall | ThinkingBlock | BashExecution | ErrorNotice`).

**Message** — A user or assistant entry in the transcript. In code:
`TranscriptMessage`; Pi stores the raw messages it is built from.

**Tool (Pi)** — A function the agent can call, such as read, write, edit, bash,
or grep.

**Tool call, tool result (Pi)** — The agent's request to run a tool and the
output it produced. In code: `ToolCall` carries both.

**Bash execution** — A command the user runs from the composer through bash
mode. It renders as a transcript item, not a tool call. In code:
`BashExecution`.

**Thinking (Pi)** — The model's reasoning output when a thinking level enables
it. In code: `ThinkingBlock`; Pi emits thinking deltas.

**Thinking level (Pi)** — How much reasoning a model should use: `off`,
`minimal`, `low`, `medium`, `high`, `xhigh`, or `max`. In code: Pi's
`ModelThinkingLevel`, part of `SessionControls`.

**Error notice** — An inline transcript item for a failed prompt or session
failure. Emitted as the `session_error` manager event.

## Contract shapes

**SessionSummary** — The app shape for a session row: `id`, `projectDir`,
`title`, `name`, `status`, `active`, `waiting`, `unread`, `lastActivity`.

**SessionControls** — The app shape for a session's model and thinking
selection: `models`, `selectedModel`, `thinkingLevel`, `thinkingLevels`.

**SessionControlsInput** — What `getSessionControls` reads without creating a
session: `projectDir` plus optional `provider`/`modelId` for a preview.

**SessionCreateOptions** — Tool selection applied when a session starts:
`tools`, `excludeTools`, `noTools`, and in-process `customTools`.

**SessionQueue** — Pending `steering` and `followUp` messages for one session,
plus `pendingCount`.

**CustomMessageInput, CustomMessageDelivery** — A message an agent consumer
injects into a transcript, and how it enters the session (`triggerTurn`,
`deliverAs`: `steer`, `followUp`, or `nextTurn`).

**SessionStats, ContextUsage, CompactionResult** — Pi result shapes the manager
forwards: per-session counters, current context usage, and the outcome of a
compaction.

**BashResult** — The result of one composer bash command: `output`, `exitCode`,
`cancelled`, `truncated`, and an optional `fullOutputPath`.

**ModelSummary** — The renderer's slim projection of a model: `provider`, `id`,
`name`.

**ProviderSummary** — The renderer's provider row: `id`, `name`, `configured`.

**Extension request, response** — A dialog raised by an extension (select,
confirm, input, or editor) and the answer sent back. In code:
`ExtensionRequest`, `ExtensionResponse`, `extension_request`.

**TrustRequest, TrustDecisionEntry, DefaultProjectTrust** — The trust dialog
request, a saved decision, and the global fallback.

**AgentManagerEvent** — The manager's event union: `session_update`,
`session_controls`, `session_activity`, `session_transcript`, `session_error`,
`extension_error`, `extension_request`, `trust_request`, and `trust_update`.
`session_activity` carries Pi's raw event unchanged.

**BotApi** — The TypeScript interface for the preload bridge exposed as
`window.dotbot`: `window`, `agent`, `providers`, `trust`, `stats`, `projects`,
`files`, and `git` namespaces.

**FileEntry, FilesChanged** — One file-tree row (`name`, `path`, `kind`) and a
watcher batch (`projectDir`, `paths`).

**GitStatus, GitChange** — Repository status (`projectDir`, `repoRoot`,
`branch`, `changes`, `error`) and one porcelain change (`path`, `indexStatus`,
`worktreeStatus`).

**UsageStats** — The Dashboard payload: a zero-filled `days` series and one
summary per range key (`365`, `180`, `90`, `30`, `7`).

## Provider and model

**Provider (Pi)** — A service that serves models, such as Anthropic, OpenAI, or
a local Ollama. Pi resolves credentials; Dotbot stores API keys through
`ProviderRegistry`.

**Model (Pi)** — One model offered by a provider. The renderer selects models by
`provider/id`.

**Provider API** — The protocol Dotbot can write for a custom provider:
`openai-completions`, `openai-responses`, `anthropic-messages`, or
`google-generative-ai` (`PROVIDER_APIS`).

**Custom provider** — A provider entry Dotbot writes into Pi's `models.json`:
id, base URL, API, and model ids.

## Packages and IPC

| Package | Owns |
| --- | --- |
| `@dotbot/agent-core` | The Pi containment boundary: `AgentManager`, `ProviderRegistry`, `TrustManager`, the app contract types |
| `@dotbot/files` | Project file tree reads and the file watcher |
| `@dotbot/git` | Git status, staging, and commits |
| `app/` | Electron main, preload bridge, Solid renderer |

IPC namespaces: `agent:*` (sessions), `providers:*` (provider keys),
`trust:*` (trust defaults and decisions), `stats:*` (dashboard), `project:*`
(picking), `files:*` (tree and watcher), `git:*` (status and mutations),
`window:*` (chrome). Push channels: `agent:event`, `files:changed`,
`window:maximized`.

## Rules

- One word per concept. A synonym is a defect, not a style choice.
- Pi's noun wins wherever Pi names the concept.
- Dotbot coins a name only for a concept Pi lacks: workspace, project,
  projectDir, screen, files, git panel, unread, usage stats, transcript, trust.
- `Agent*` names describe the executor or its manager, never a session, its
  record, its events, or its transcript.
- App-facing payload fields say `projectDir`; Pi's `cwd` appears only where Pi's
  API is called inside `@dotbot/agent-core`.
- The preload bridge is `window.dotbot`, typed as `BotApi`. Do not reintroduce
  `DotbotApi` or the pre-rename Aria names.

### Banned synonyms

| Banned | Use |
| --- | --- |
| task, template | session, newSession |
| feedback, feedback_request | extension request, `extension_request` |
| command, set_model, set_thinking_level | `setModel`, `setThinkingLevel` |
| source-control, Source Control | git, Git |
| cwd in app-facing payloads | projectDir |
| history for the renderer model | transcript |
| workspace as a package name | `@dotbot/files` |
| DotbotApi, Aria, aria bridge | `BotApi`, Dotbot, `window.dotbot` |
| openedWorkspaces | openedProjects |
