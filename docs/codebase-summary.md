# Claude Switch Profile — Codebase Summary

**Version:** 1.1.0 | **Runtime:** Node.js ≥ 18 (ES modules) | **Deps:** chalk, commander

## What It Does

CLI tool (`csp`) for managing multiple Claude Code configurations. Profiles capture symlinks (rules, agents, skills, hooks) and mutable files (settings.json, .env) from `~/.claude`, stored in `~/.claude-profiles/`.

## Project Structure

```
bin/csp.js              → CLI entry point (commander.js, 12 commands)
src/commands/           → 12 command files (init, current, list, create, save, use, delete, export, import, diff, launch, uninstall)
src/constants.js        → Paths, managed item lists (SYMLINK_ITEMS, COPY_ITEMS, COPY_DIRS, NEVER_TOUCH)
src/platform.js         → Cross-platform layer (isWindows, symlinkType → junction, findProcess)
src/profile-store.js    → Metadata CRUD (profiles.json, .active marker)
src/symlink-manager.js  → Symlink read/create/save/restore + real-dir-to-symlink migration
src/file-operations.js  → File/directory copy/restore
src/safety.js           → Lock file (PID), auto-backup (max 2), Claude process detection
src/profile-validator.js → Profile structure + symlink target validation
src/output-helpers.js   → Colored console output (✓ ⚠ ✗ ℹ)
tests/                  → 3 test files: core-library, cli-integration, safety
```

## Key Patterns

- **Symlink vs Copy strategy**: Rules/agents/skills → symlinks to external repos. Settings/.env → copied per profile.
- **Real-dir handling**: `saveSymlinks()` auto-migrates real dirs to profile dir, replacing with symlink.
- **Windows**: NTFS junctions (no admin), `tasklist` for process detection, `claude.cmd` for launch.
- **Safety**: Lock file prevents concurrent ops; stale lock detection via PID check; auto-backup on every switch (pruned to 2).
- **Env overrides**: `CSP_HOME`, `CSP_CLAUDE_DIR`, `CSP_PROFILES_DIR` for isolated testing.

## Recent Changes (v1.1.0)

- Added `launch` command (switch + spawn Claude with arg forwarding)
- Added `uninstall` command (restore profile + wipe all data)
- Added `platform.js` for Windows/Unix cross-platform support
- `saveSymlinks` handles real dirs/files (moves + creates symlink)
- `removeSymlinks` handles real dirs/files (not just symlinks)

---

*Last updated: 2026-03-23*
