# Phase 1: Project Setup & Constants

> Plan: `plans/2026-03-11-claude-switch-profile/plan.md`
> Depends on: None
> Parallel-safe: Yes — no dependencies

---

## Objective

Initialize Node.js project with Commander.js, define all constants (managed items, paths, defaults), and create the CLI entry point.

---

## Task List

### Task 1.1 — Initialize package.json

- **File**: `package.json`
- **Action**: Create package.json with name `claude-switch-profile`, bin entry `csp` -> `bin/csp.js`, type `module`, commander dependency
- **Test**: `node bin/csp.js --help` — should show help text

### Task 1.2 — Create CLI entry point

- **File**: `bin/csp.js`
- **Action**: Create executable entry with `#!/usr/bin/env node`, import commander, register all subcommands. Set version, description. Each command imported from `src/commands/*.js`
- **Test**: `node bin/csp.js --version` — should print version

### Task 1.3 — Define constants and config schema

- **File**: `src/constants.js`
- **Action**: Export all constants:
  - `PROFILES_DIR`: `~/.claude-profiles`
  - `CLAUDE_DIR`: `~/.claude`
  - `ACTIVE_FILE`: `.active`
  - `PROFILES_META`: `profiles.json`
  - `SOURCE_FILE`: `source.json`
  - `SYMLINK_ITEMS`: array of items managed via symlinks (`CLAUDE.md`, `rules`, `agents`, `skills`, `hooks`, `statusline.cjs`, `.luna.json`)
  - `COPY_ITEMS`: array of mutable files managed via copy (`settings.json`, `.env`, `.ck.json`, `.ckignore`)
  - `COPY_DIRS`: array of dirs managed via copy (`commands`, `plugins`)
  - `NEVER_TOUCH`: array of runtime dirs/files to never modify
  - `LOCK_FILE`: `.lock`
  - `BACKUP_DIR`: `.backup`
- **Test**: Import and verify all exports exist

### Task 1.4 — Install dependencies

- **File**: `package.json`
- **Action**: Run `npm install commander chalk` (chalk for colored output)
- **Test**: `node -e "require('commander')"` — no errors

---

## Expected Outcome

- `npm install` succeeds
- `node bin/csp.js --help` shows program name and available commands
- All constants properly exported and importable
