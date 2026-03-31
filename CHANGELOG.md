# Changelog

All notable changes to `claude-switch-profile` are documented here.

## [Unreleased] - 2026-03-31

### Changed
- `default` is now a physical profile snapshot created by `csp init` instead of a virtual pass-through.
- `csp save`, `csp use`, `csp export`, `csp launch`, and `csp uninstall` now operate on the `default` snapshot the same way they do for other profiles.
- Legacy installs missing `~/.claude-profiles/default` only backfill that snapshot when the active profile is `default` or no active profile is set; if a non-default profile is active, CSP fails closed with repair guidance.
- Protected and session/runtime files remain excluded from snapshot capture, export, isolated runtime sync, and restore flows.
- Launching `default` keeps its metadata mode as `legacy` instead of drifting to `account-session`.

---

## [1.3.0] - 2026-03-28

### Added
- ✨ **Interactive profile selector** — Run `csp` with no arguments to get an arrow-key profile picker that launches isolated sessions. Supports ↑/↓/j/k navigation, Enter to select, Esc to cancel.
- ✨ **`csp status`** — Dashboard showing active profile, profile count, last launch info, and Claude running status at a glance.
- ✨ **`csp toggle`** — Quick-switch to the previous profile (like `cd -`). Uses isolated launch, never touches ~/.claude.
- ✨ **`csp select`** — Explicit alias for the interactive selector.

### Changed
- 🔒 **`~/.claude` is never modified** — All profile operations now use isolated runtime (`CLAUDE_CONFIG_DIR`). The `default` profile is a virtual alias for `~/.claude` as-is.
- 🔒 **`default` profile is virtual** — `csp init` no longer creates a physical directory for the default profile. Default means "use ~/.claude directly".
- 🔒 **`csp launch default`** — Launches Claude with native `~/.claude` (no runtime dir, no `CLAUDE_CONFIG_DIR` override).
- 🔒 **`csp deactivate`** — Now simply resets active marker to `default`. No longer deletes files from `~/.claude`.
- ⚠️ **`csp use` deprecated** — Shows warning that it modifies `~/.claude` (legacy mode). Users should prefer `csp launch`.
- 🔄 **`csp toggle`** — Now uses `launch` (isolated) instead of `use` (legacy).

### Fixed
- 🐛 Removed dead `--force` option from `csp use`.
- 🐛 Fixed double `getActive()` call in `init` command.
- 🐛 Fixed stale "symlink targets" comment in safety.js.
- 🐛 Removed unused parameter in diff.js.

---

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
