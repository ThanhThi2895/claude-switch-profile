# Claude Switch Profile — Codebase Summary

**Version:** 1.2.0 | **Runtime:** Node.js ≥ 18 (ES modules) | **Deps:** chalk, commander

## What It Does

`csp` manages Claude Code profile state in two modes:
- **Legacy global mode (`csp use`)**: mutates `~/.claude` and `.active`.
- **Isolated account-session mode (`csp launch`)**: syncs static profile config into `~/.claude-profiles/.runtime/<profile>` and launches Claude with `CLAUDE_CONFIG_DIR` set to that runtime root.

## Project Structure

```
bin/csp.js                     → CLI entry point (commander.js, 13 commands)
src/commands/                  → init, current, list, create, save, use, delete, export, import, diff, deactivate, launch, uninstall
src/constants.js               → Paths + managed item lists + runtime constants
src/profile-store.js           → profiles.json v2 normalization + active marker + runtime metadata
src/runtime-instance-manager.js → Runtime sync/seed for isolated launch
src/item-manager.js            → Managed item copy/move/read/remove
src/file-operations.js         → COPY_ITEMS/COPY_DIRS save/restore/remove + settings path rewriting
src/safety.js                  → Global lock + per-profile runtime lock + backup pruning (max 2)
src/profile-validator.js       → Profile structure validation
src/platform.js                → Cross-platform process checks (`tasklist`/`pgrep`)
src/output-helpers.js          → CLI output helpers
tests/*.test.js                → Core, CLI integration, safety
```

## Implemented Behaviors Verified

- Profile metadata stored in `profiles.json` with schema `version: 2` and per-profile fields (`mode`, `runtimeDir`, `runtimeInitializedAt`, `lastLaunchAt`).
- Managed static items include `CLAUDE.md`, `rules`, `agents`, `skills`, `hooks`, statusline files, `.luna.json`.
- Copied mutable files include `settings.json`, `.env`, `.ck.json`, `.ckignore`, `.mcp.json`, `.mcp.json.example`, `.env.example`, `.gitignore`.
- Copied directories include `commands`, `plugins`, `workflows`, `scripts`, `output-styles`, `schemas`.
- Runtime/session paths listed in `NEVER_TOUCH` are excluded from managed operations.
- Backups are created by `createBackup()` and pruned to 2 most recent snapshots.
- `csp use` now fails fast while Claude Code is running; internal legacy launch can still bypass via existing internal option.
- Isolated launch resolves allowlisted `ANTHROPIC_*` deterministically with precedence (`settings.json env` > profile `.env` allowlist > parent env), strips inherited `CLAUDECODE`/`CLAUDE_CONFIG_DIR` and inherited `ANTHROPIC_*`, then sets runtime `CLAUDE_CONFIG_DIR`.

## Notes from repomix-output.xml

- Packed snapshot includes this repo plus embedded `ccs-main/` content present in workspace.
- Current docs and source for CSP are under repository root (`bin/`, `src/`, `tests/`, `docs/`).

---

*Last updated: 2026-03-26*
