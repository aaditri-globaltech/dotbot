# Changelog

## [0.2.0] - 2026-09-25
### Added

- Added `@dotbot/agent-core` as the app's Pi containment boundary: named Pi SDK re-exports plus Dotbot's in-process `AgentManager`, `ProviderRegistry`, and `TrustManager`.
- Added `AgentManager` for creating, opening, prompting, aborting, closing, and discarding sessions, and for forwarding `AgentManagerEvent` updates to the app.
- Added session capabilities: model and thinking selection, active tool sets, custom messages, session names, compaction, session stats, context usage, and steer and follow-up queue inspection.
- Added `ProviderRegistry` for provider listing, API key set and removal, and custom provider entries in the runtime's `models.json`.
- Added `TrustManager` for project trust decisions and the global default, resolved before a session starts.
- Added `getSessionControls` for a project's model and thinking choices without creating a session, and `getSessionsDir` for consumers that read persisted session files.
- Added `buildTranscript` and the app-facing contract types.
- Added the runtime branding patch script (`npm run patch`), which writes the app name "bot" and config directory ".bot" into the installed runtime; it runs as the package's postinstall hook and explicitly in CI.

### Changed

- The branded runtime now resolves `~/.bot/agent` itself instead of relying on a data-directory environment variable.
- Session summaries always carry `lastActivity`, stamped when the session is created.
- Aligned the session vocabulary with Pi: a session id is Pi's session id, and `projectDir` replaces the app-facing `cwd`.
