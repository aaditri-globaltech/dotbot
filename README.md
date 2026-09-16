# Aria

Electron workspace UI with in-process agent sessions.

## Project metadata

- License: [MIT](LICENSE)
- Author: Kumar Rahul Anand
- Maintainer: Aaditri GlobalTech
- Homepage: [Aria](https://github.com/Aaditri-GlobalTech/aria#Aria)

## Architecture

Aria is an npm workspace monorepo. The Electron main process embeds the agent
runtime directly; there is no separate host process.

- `app/` — Electron shell, preload bridge, and React/Vite renderer.
- `packages/agent-core/` — named re-exports of the agent runtime plus Aria's in-process session manager.
- `packages/workspace/` — Explorer filesystem access.
- `packages/source-control/` — Git status, staging, and commit operations.

### Runtime flow

1. Electron starts and creates one `AgentSessionManager` in the main process.
2. The renderer asks the preload bridge to create or open a session.
3. The manager creates an `AgentSession` in-process with the workspace as its `cwd`.
4. Agent events stream through the manager to the renderer over `agent:event` IPC.
5. Explorer and Source Control calls run against the workspace and Git packages through validated IPC.

Renderer code is type-only when it imports from the packages; all Node and
agent-runtime work stays in the main process. The main bundle keeps the agent
runtime external and resolves it from `node_modules`.

Before contributing, read [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Features

- Workspace-based agent sessions grouped in the session sidebar, with session tabs and streamed assistant output.
- Inline thinking, user prompts, tool calls, status updates, and extension feedback dialogs.
- Model and thinking-level selection, stop controls, and steer/follow-up prompts while a turn is running.
- Open sessions reuse their in-process agent session after a turn settles; the selected and other workspace session lists scroll independently.
- VS Code-style activity views with an expandable Explorer and local Git Source Control for the active workspace.
- Resizable workbench panels, system-tray minimize/restore, and Linux AppImage/deb and Windows NSIS packaging.

### Keyboard defaults

- `Enter` submits a prompt; `Shift+Enter` inserts a newline.
- `Ctrl+Enter` commits a Source Control message.
- Arrow keys resize the focused panel.

### Transcript rendering

- Assistant prose is left-aligned; fenced code uses Highlight.js syntax highlighting and `mermaid` fences render diagrams.
- Thinking is inline italic text and user prompts are right-aligned dark bubbles.
- Bash and other generic tools render as `$` command blocks with streamed arguments and output.
- Every tool card is collapsible; `read`, `edit`, and `write` render without `$` and show the workspace path.
- `read` shows its requested line range; `edit` displays the agent's line-numbered diff; `write` displays the content written.
- The transcript and tool output follow streamed content until the user scrolls away, while older session history loads in pages.

### Session behavior

- A new session starts with the label `new session` and adopts its first prompt as the fallback title.
- An accepted prompt is shown as working immediately. While a turn is running, `Steer` sends input before the next provider request; `Follow up` waits until the current turn finishes.
- A completed turn marks the session idle but keeps its in-process agent session open. Closing the session disposes that session.

## Prerequisite

Git is optional for the Explorer but required for Source Control; install Git
and put it on `PATH` if you want branch, status, staging, and commit actions.
The agent runtime is a dependency of `packages/agent-core`; no separate install
is required.

## Use Aria

From the repository root, install dependencies and start the development app:

```sh
npm install --ignore-scripts
npm run prepare
npm run dev
```

Choose a workspace in Explorer, create a session, and send prompts. Sessions
persist between runs.

## Development

Run the local checks with:

```sh
npm run check
```

`check` formats and lints with warnings treated as errors, then typechecks.
Run the tests with:

```sh
npm test
```

For renderer or bundling changes, also run:

```sh
npm run check:browser-smoke
```

## Releases

Build artifacts locally on the matching host:

```sh
npm run release:linux    # app/release/*.AppImage and app/release/*.deb
npm run release:windows  # app/release/*Setup*.exe
```

Bump `app/package.json`, commit, and push a `v<version>` tag. Pushing the tag
builds Linux and Windows artifacts in GitHub Actions and attaches them to the
GitHub release. Every pushed commit runs the CI build and checks, while local
commits run the validation check through Husky's pre-commit hook.
