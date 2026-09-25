# Changelog

## [0.2.0] - 2026-09-25
### Added

- Added `@dotbot/files` with project directory validation, directory reads that return project-relative entries with directories first and `.git` filtered, and a recursive watcher that forwards normalized change batches through `@parcel/watcher`.

### Changed

- `watchDirectory` no longer passes a hand-written ignore list; consumers decide what to ignore and the watcher's own defaults apply.
