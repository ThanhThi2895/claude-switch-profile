# Changelog

All notable changes to `claude-switch-profile` are documented here.

## [1.1.0] - 2026-03-13

### Added
- ✨ **`csp uninstall` command** — Cleanly remove CSP and restore a chosen profile to `~/.claude` before wiping all profile data. Supports `--force` and `--profile <name>` flags.

### Changed
- 🔄 **`saveSymlinks` now handles real dirs/files** — When a managed item in `~/.claude` is a real directory or file (not yet a symlink), `saveSymlinks` moves it into the profile directory and replaces it with a symlink in-place. Fixes the case where switching from a fresh `~/.claude` setup left the default profile empty.
- 🔄 **`removeSymlinks` now removes real dirs/files** — Previously only removed symlinks; now also removes real directories and files for managed items so `createSymlinks` is never blocked.
- 🔄 **`createSymlinks` uses `rmSync` instead of `unlinkSync`** — Correctly handles pre-existing directories (not just files/symlinks) when restoring a profile.

### Fixed
- 🐛 **`statusline.cjs` broken after switch to default profile** — `saveSymlinks` was copying the file into the profile directory, causing `require('./lib/...')` to fail because `lib/` does not exist there. Now the file stays as a symlink pointing to the source project.

---

## [1.0.2] - 2026-03-12

### Fixed
- 🐛 **`csp create` produces clean profiles** — New profiles no longer inherit the current session state; they start empty and isolated.

### Changed
- 🔄 **Max backups reduced to 2** — Keeps `.backup/` lean.

---

## [1.0.1] - 2026-03-11

### Fixed
- 🐛 Initial bug fixes after first release.

---

## [1.0.0] - 2026-03-11

### Added
- ✨ Initial release of `claude-switch-profile`
- `csp init`, `csp create`, `csp use`, `csp save`, `csp list`, `csp current`
- `csp delete`, `csp export`, `csp import`, `csp diff`
- Symlink + copy strategy for isolating Claude Code profiles
- Lock file, automatic backups, Claude process detection
- Environment variable overrides (`CSP_HOME`, `CSP_CLAUDE_DIR`, `CSP_PROFILES_DIR`)
