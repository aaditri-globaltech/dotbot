# Changelog

## [Unreleased]
### Added

- Added Dashboard, Workbench, and Manage screens behind a project sidebar that replaces the activity rail, menu bar, and status bar.
- Added usage stats on the Dashboard: message and token totals, a daily activity heatmap, streaks, and tokens per model, computed from persisted session files and cached under the app's user data.
- Added project trust prompts, with remembered per-project decisions and a global default and revoke in Manage.
- Added provider management in Manage: provider status, API key save and removal, and custom provider entries.
- Added a new-session pane where the first keystroke starts the session, applying its model and thinking choices before the first prompt.
- Added per-project model and thinking defaults, read without creating a session.
- Added `!` and `!!` composer commands that run in the session and render as bash transcript items with streamed output and completion status.
- Added workspace file watching so the file tree and Git panel refresh on changes, with Git-internal paths ignored and bursts debounced.

### Changed

- Moved renderer state from hooks into solid-js/store factories whose actions are the only writers, coalescing streamed events per animation frame.
- Rebuilt the shell around a raised sidebar with the brand, screen rows, and every project with its sessions, plus a top strip with session tabs and window controls and an icon rail when the sidebar is collapsed.
- Moved the file tree into the sidebar as a project mode that owns the workspace watcher.
- Restyled the app with Tailwind v4 utilities over the VS Code Dark 2026 token set, with role-based semantic tokens and type and spacing scales.
- Replaced the renderer's `aria-*` automation attributes with plain attribute names declared once in `plain-attributes.d.ts`.
- The main process now runs one AgentManager and one ProviderRegistry and exposes them through the typed `window.dotbot` bridge.
- Replaced the Kobalte dropdown and dialog with the app's own dropdown and a native `<dialog>` modal, dropping the dependency.
- Renamed app-facing `cwd` fields to `projectDir` and renamed the app's panels to the file tree and Git panel.

### Fixed

- Opened markdown links in the system browser instead of replacing the app window.
- Kept the composer visible in tight layouts and kept a searchable dropdown's trigger in place while searching.
- Fixed dashboard scrolling and button typography after the Tailwind conversion.
- Prevented a space key press from activating the highlighted option in a searchable dropdown.

## [0.1.5] - 2026-08-27
### Added

- Added file-aware Highlight.js coloring for `read`, `edit`, and `write` tool output.
- Added generic in-progress tool argument and output rendering for streamed agent events.
- Kept large session histories responsive by loading chat items in chunks, rendering the newest messages first, and batching updates per animation frame.

### Changed

- Replaced Shiki with Highlight.js for lighter fenced-code highlighting.
- Expanded inline renderer bridge documentation and aligned app documentation with the current host configuration.
- Connected the Electron main process to the Bun host through a per-launch local socket or Windows named pipe instead of the default stdio path.
- Kept Explorer and Source Control workspace selection independent from the selected session, with remembered workspace choices.
- Put the selected workspace's sessions first and collapsed other workspace groups by default.
- Reduced tool card dimensions and changed tool disclosure indicators to status-colored icons.
- Restored tool disclosure arrows, moved status icons to the right side of tool rows, kept workspace names with their scrollable session groups, and moved the workspace action to Explorer.
- Refined tool input wrapping, labels, read ranges, and width to keep commands readable.
- Kept the selected chat session pinned to the latest output with a floating jump-to-latest control when scrolled away.
- Top-aligned tool input labels, arguments, disclosure arrows, and status indicators.
- Anchored the selected workspace session group at the top and unselected groups at the bottom, with independent session scrolling.
- Rendered `read`, `write`, and `edit` output as non-wrapping numbered editor panes and completed shared Markdown styling for user and assistant streams.
- Kept edit diff numbering from being duplicated, limited long Bash command headers to four wrapped lines, and rendered tool errors as unnumbered red text.
- Removed the redundant read-range colon and kept tool names intact while wrapping long paths only at natural break points.
- Restored visible Markdown bullets and numbering after the CSS reset, and changed the labels that named the runtime to the assistant role.
- Kept the selected session workspace header at the top, contained each workspace's session list, widened toolbox padding, reduced toolbox width to 95%, and restored scroll chaining to the chat.
- Kept read offsets as unwrapped gold labels beside the tool name while allowing the filename area to absorb wrapping.

### Fixed

- Marked accepted prompts as working immediately while keeping the open session alive after a turn settles.
- Fixed selected and secondary workspace session lists so the selected list scrolls independently, other lists stay contained, and expanded groups show four sessions before scrolling.
- Fixed workspace group styling, failed tool coloring, chat tab responsiveness, jump-to-latest placement, and new-session naming.
- Prevented unlabeled text blocks from receiving incorrect syntax colors.
- Prevented large session startup histories from blocking chat tab switching.
- Kept tool output on its existing background while applying syntax colors.
- Restored subtle diff text fills: dim context, dark red removed text, and equally dark green added text.

## [0.1.4] - 2026-08-26
### Added

- Added Mermaid diagram rendering and Shiki syntax highlighting for fenced code in chat messages.
- Added automatic bottom-following for streamed transcript and tool output.
- Added collapsible tool cards and compact `read` line ranges.
- Added the Electron-to-Bun `HostClient` using the generic JSON-RPC protocol over stdio.
- Added the typed `window.aria` renderer bridge.
- Added development and packaged extension source configuration.
- Configured Electron Builder to package the Bun Core host and built-in extension modules as application resources.

### Changed

- Routed Agent, Explorer, and Source Control requests through configured generic Core capabilities.
- Moved version bumping to the repository-level release command so tags match the app version.
- Documented host resource resolution and extension capability routing.
- Refined transcript presentation with reduced horizontal padding and hover-only scrollbars.
- Moved the desktop client, renderer, preload, tests, and build configuration into the `app` workspace.
- Centralized editor, commit, and panel-resizing keyboard defaults.
