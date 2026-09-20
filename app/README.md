# Dotbot desktop app

The Electron client for Dotbot. It contains the React/Vite renderer, Electron
main process, and preload bridge. The main process embeds `@dotbot/agent-core`,
which wraps the agent runtime in-process.

## Use the app

From the repository root:

```sh
npm install --ignore-scripts
npm run prepare
npm run dev
```

Open a project with the Files folder action, then use the session pane
to create or open an agent session. New sessions use the label `new session`
until their first prompt supplies a fallback title. Git is optional for Files
and required for the Git panel. The agent runtime is bundled through
`@dotbot/agent-core`; no separate install is required.

## Responsibilities

- Render the workspace UI with React and Zustand.
- Own windows, custom controls, tray behavior, and native folder selection.
- Expose the narrow typed `window.dotbot` bridge to the renderer.
- Run one `AgentManager` and one `ProviderRegistry`, and forward Agent manager events to the renderer.

Filesystem and Git logic belongs in `@dotbot/files` and
`@dotbot/git`, not in Electron or the renderer.

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
follows streamed output while the user is at the bottom, loads older transcript items on
demand, and offers a jump-to-latest control after the user scrolls away.

## Styling

Components use Tailwind v4 utilities. `src/renderer/index.css` is the entry:
it imports Tailwind, then the vendored icon and highlight stylesheets, then
`styles/app.css`.

Cascade layers decide which stylesheet wins:

- Tailwind emits its own layers (`theme`, `base`, `components`, `utilities`).
- Vendored stylesheets are imported into `layer(base)`, so utilities can
  override them. Without this, `.codicon[class*='codicon-'] { font: … }` would
  beat `text-4xl` and icons could never be resized with a utility.
- `styles/app.css` stays unlayered, so anything left in it beats every
  utility. Keep it to the cases below, and move a rule into a utility class
  when you touch that markup.

`styles/app.css` keeps only what utilities cannot express:

- The resizable workbench grid: `workspace-layout`, `view-area`, the
  `*.is-collapsed` panels, and the `panel-border` resize handles, which are
  driven by the CSS variables `useResizablePanels` sets inline.
- `.agent-markdown-text` and its descendants. These are element selectors for
  HTML generated from markdown, so the class stays on the wrapper purely as a
  styling hook.
- Global scrollbars, `@keyframes`, and the highlight.js additions/deletions
  theme.

Semantic tokens mirror the palette, so use them instead of hex values:
`bg-app`, `bg-surface`, `bg-surface-hover`, `bg-card`, `bg-elevated`,
`bg-input`, `bg-button`, `bg-control`, `text-primary`, `text-secondary`,
`text-muted`, `text-dim`, `text-faint`, `text-code`, `border-border`,
`border-border-strong`, `border-border-strong-hover`, `text-accent`,
`border-focus`, `text-success`, `text-warning`, `text-error`, and
`bg-window-close`. Values live in the `@theme` block of `index.css`; add a
token there rather than a new hex value. Genuinely one-off colors (the diff
backgrounds in the edit tool card) use arbitrary values.

Presentation shared by several components lives in small modules rather than
repeated class strings: `panels/chat-classes.ts`, `panels/panel-classes.ts`,
`panels/status-dot.ts`, and `screen/manage/manage-classes.ts`.

Two details worth knowing:

- Tailwind only emits the variables of tokens that a utility actually uses, so
  `var(--color-surface)` is empty until something uses `bg-surface`.
- Biome needs `css.parser.tailwindDirectives` (set in the repository
  `biome.json`) to parse `@theme` and other Tailwind at-rules.

## Session behavior

Opening a session creates one in-process agent session and loads its transcript
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
include the production dependencies of `@dotbot/agent-core`.

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
- [`../packages/files`](../packages/files)
- [`../packages/git`](../packages/git)
