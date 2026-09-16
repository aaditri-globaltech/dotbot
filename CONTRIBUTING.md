# Contributing to Dotbot

## Before contributing

Dotbot is an npm workspace monorepo containing an Electron client and three
support packages. Read the root `README.md` and `AGENTS.md` before making
changes.

Keep changes focused and understand the behavior and interactions of every change, including changes produced with AI assistance.

## Development setup

Use Node 24 or a compatible version, then install dependencies without running lifecycle scripts:

```sh
npm install --ignore-scripts
npm run prepare
npm run dev
```

Git is required for Source Control features. The agent runtime is provided by
`packages/agent-core`; no separate install is required.

## Repository structure

- `app/` — Electron main process, preload bridge, and React/Zustand renderer.
- `packages/agent-core/` — agent runtime re-exports and the in-process session manager.
- `packages/workspace/` — Explorer filesystem access.
- `packages/source-control/` — Git status, staging, and commit operations.

Keep agent session behavior in `agent-core` and filesystem or Git behavior in
the matching package rather than in Electron or the renderer.

## Validation

Run the root check before opening a pull request:

```sh
npm run check
```

This formats and lints with warnings treated as errors, then typechecks. Run
the tests with:

```sh
npm test
```

For renderer or bundling changes, also run:

```sh
npm run check:browser-smoke
```

Build commands are for packaging validation, not routine changes.

## Issues

Use the structured issue forms. Bug reports should include concise reproduction steps, expected and actual behavior, environment details, and sanitized logs when relevant. Feature requests should describe the problem and a focused proposed solution. Do not include secrets or other sensitive data.

## Pull requests

- Explain the problem and the solution.
- List the validation commands you ran.
- Include screenshots or recordings for renderer and UI changes.
- Add an entry to the affected package's `CHANGELOG.md` under `Unreleased` when required by `AGENTS.md`.
- Keep dependency versions pinned and review any `package-lock.json` changes.
- Do not include generated release artifacts, credentials, or unrelated formatting changes.
