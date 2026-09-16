# Aria desktop app

The Electron client for Aria. It contains the React/Vite renderer, Electron
main process, and preload bridge. The main process embeds `@aria/agent-core`,
which wraps the agent runtime in-process.

## Use the app

From the repository root:

```sh
npm install --ignore-scripts
npm run prepare
npm run dev
```

Choose a workspace with the Explorer folder action, then use the session pane
to create or open an agent session. New sessions use the label `new session`
until their first prompt supplies a fallback title. Git is optional for
Explorer and required for Source Control. The agent runtime is bundled through
`@aria/agent-core`; no separate install is required.

## Responsibilities

- Render the workspace UI with React and Zustand.
- Own windows, custom controls, tray behavior, and native folder selection.
- Expose the narrow typed `window.aria` bridge to the renderer.
- Run one `AgentSessionManager` and forward only Agent manager events to the renderer.

Filesystem and Git logic belongs in `@aria/workspace` and
`@aria/source-control`, not in Electron or the renderer.

## Chat rendering

Assistant messages preserve prose and render fenced code with Highlight.js
syntax highlighting. Fenced `mermaid` blocks render diagrams with Mermaid's
strict security mode; invalid or unsupported blocks fall back to raw text.
Thinking is shown inline, user prompts are right-aligned, and tool cards are
collapsible.

`read` and `write` output use the file extension for language detection, while
`edit` output uses diff highlighting. Tool cards update their arguments and
output while the agent streams them. These tool outputs show line numbers; `read`
starts at its requested offset. Errors remain unnumbered. The transcript
follows streamed output while the user is at the bottom, loads older history on
demand, and offers a jump-to-latest control after the user scrolls away.

## Session behavior

Opening a session creates one in-process agent session and loads its history
and state. A completed turn changes the session to idle but keeps that session
available while the tab is open. Accepted prompts show `Working…` immediately;
while a turn is running, the composer can send a message as `Steer` before the
next provider request or as `Follow up` after the current turn finishes.
Closing the session disposes a settled agent session.

## Main-process configuration

| Variable | Purpose |
| --- | --- |
| `ELECTRON_PRELOAD_PATH` | Override the bundled preload path, mainly for development. |
| `VITE_DEV_SERVER_URL` | Load the renderer from the Vite dev server instead of `dist/`. |

The embedded runtime reads its own configuration from the user's home
directory. It resolves models, credentials, and sessions from there unless the
user overrides them through its own environment variables.

## Packaging

The app-local build creates Electron assets only:

```sh
npm run --workspace app build
```

The agent runtime stays external in the main bundle, so the packaged app must
include the production dependencies of `@aria/agent-core`.

The complete packaging commands are:

```sh
npm run build
npm run release:linux
npm run release:windows
```

## Development checks

```sh
npm run --workspace app test
npm run --workspace app typecheck
npm run check:browser-smoke
```

## Related packages

- [`../packages/agent-core`](../packages/agent-core)
- [`../packages/workspace`](../packages/workspace)
- [`../packages/source-control`](../packages/source-control)
