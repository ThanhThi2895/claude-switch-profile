# Claude Switch Profile — Codebase Summary

**Version:** 1.4.0 | **Runtime:** Node.js ≥ 18 (ES modules) | **Deps:** chalk, commander

## What It Does

`csp` manages Claude Code profile state in two modes:
- **Legacy global mode (`csp use`)**: mutates `~/.claude` and `.active` using physical profile snapshots, including `default`.
- **Isolated account-session mode (`csp launch`)**: syncs static profile config into `~/.claude-profiles/.runtime/<profile>` and launches Claude with `CLAUDE_CONFIG_DIR` set to that runtime root.
- **Legacy migration guard**: if an older install has `default` metadata but no `profiles/default`, CSP only backfills that snapshot when the active profile is `default` or no active profile is set.

## Project Structure

```
bin/csp.js                          → CLI entry point (commander.js, 16 commands)
src/commands/                       → init, current, list, create, save, use, delete, export,
                                      import, diff, deactivate, launch, uninstall, toggle,
                                      status, select
src/constants.js                    → Paths + managed item lists + runtime constants
src/profile-store.js                → profiles.json v2 normalization + active marker + runtime metadata
src/runtime-instance-manager.js     → Runtime sync/seed for isolated launch
src/item-manager.js                 → Managed item copy/move/read/remove
src/file-operations.js              → COPY_ITEMS/COPY_DIRS save/restore/remove + settings path rewriting
src/launch-effective-env-resolver.js → ANTHROPIC_* env precedence resolution + session env stripping
src/safety.js                       → Global lock + per-profile runtime lock + backup pruning (max 2)
src/profile-validator.js            → Profile structure validation
src/platform.js                     → Cross-platform process checks (tasklist/pgrep)
src/output-helpers.js               → CLI output helpers
tests/*.test.js                     → Core, CLI integration, safety
scripts/release.js                  → Release helper script
docs/                               → project-overview-pdr, system-architecture, code-standards, codebase-summary
```

## Key Behaviors

- Profile metadata stored in `profiles.json` with schema `version: 2` and per-profile fields (`mode`, `runtimeDir`, `runtimeInitializedAt`, `lastLaunchAt`).
- `csp init` creates a physical `default` snapshot in `~/.claude-profiles/default`; `save`, `use`, `export`, `launch`, and `uninstall` all operate on that snapshot.
- Managed static items: `CLAUDE.md`, `rules`, `agents`, `skills`, `hooks`, `statusline.cjs`, `statusline.sh`, `statusline.ps1`, `.luna.json`.
- Managed-item snapshots and isolated runtime sync preserve symlink shape/targets for managed items instead of flattening them into plain copies.
- Copied mutable files: `settings.json`, `.env`, `.ck.json`, `.ckignore`, `.mcp.json`, `.mcp.json.example`, `.env.example`, `.gitignore`.
- Copied directories: `commands`, `plugins`, `workflows`, `scripts`, `output-styles`, `schemas`.
- Runtime/session paths listed in `NEVER_CLONE` / `NEVER_TOUCH` are excluded from init, save, export, launch runtime sync, migration backfill, and uninstall restore operations.
- Backups are created by `createBackup()` and pruned to 2 most recent snapshots.
- `csp use` fails fast while Claude Code is running.
- `csp select` is the default command — interactive arrow-key profile picker that delegates to `launch`.
- `csp status` shows a dashboard with active profile, profile count, last launch info, and Claude running state.
- `csp toggle` switches to the previous profile via `getPrevious()` and delegates to `launch`.
- Isolated launch resolves allowlisted `ANTHROPIC_*` deterministically with precedence (`settings.json env` > profile `.env` allowlist > parent env), strips inherited `CLAUDECODE`/`CLAUDE_CONFIG_DIR`, inherited `ANTHROPIC_*`, and Claude Code session env vars (`CLAUDE_CODE_OAUTH*`, `CLAUDE_CODE_SESSION*`, etc.), then sets `CLAUDE_CONFIG_DIR` to the runtime root.
- Launching `default` keeps its profile metadata mode as `legacy`; only non-default profiles drift to `account-session` mode when launched.

---

*Last updated: 2026-03-31*
