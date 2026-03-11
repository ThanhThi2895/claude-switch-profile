# Research: CLI Profile Switching Patterns for Claude Code

**Date:** 2026-03-11 | **Scope:** Best practices, existing tool patterns, recommended approach

---

## 1. Claude Code `~/.claude/` Directory Analysis

### Profile-Switchable (config/behavior)
| Item | Type | Purpose |
|------|------|---------|
| `settings.json` | file | Hooks, model, permissions, plugins, env vars |
| `CLAUDE.md` | symlink | Global instructions |
| `rules/` | symlink | Development rules |
| `hooks/` | symlink | Hook scripts (.cjs) |
| `skills/` | symlink | Skill definitions |
| `agents/` | symlink | Agent definitions |
| `.env` | file | API keys, secrets |
| `.credentials.json` | file | OAuth/auth tokens |
| `.luna.json` | symlink | Luna framework config |
| `.ck.json` | file | ClaudeKit config |
| `statusline.cjs` | symlink | Status line script |
| `commands/` | dir | Custom slash commands |
| `plugins/` | dir | Installed plugins + config |

### NOT switchable (runtime/session data)
`projects/`, `session-env/`, `history.jsonl`, `cache/`, `debug/`, `telemetry/`, `tasks/`, `teams/`, `ide/`, `file-history/`, `paste-cache/`, `shell-snapshots/`, `todos/`, `backups/`, `agent-memory/`, `plans/`

**Key insight:** User already uses symlinks for 6 items. Symlink pattern is native to this setup.

---

## 2. Existing Tool Patterns

| Tool | Storage | Switching | Relevant Pattern |
|------|---------|-----------|-----------------|
| **nvm** | `~/.nvm/versions/node/v{x}/` | PATH modification | Named subdirs, alias file for "current" |
| **AWS CLI** | `[profile]` sections in single file | `AWS_PROFILE` env var | NOT applicable (Claude uses many files) |
| **direnv** | `.envrc` per directory | Auto on `cd` via shell hook | Auto-switch per project (future) |
| **pyenv/rbenv** | `~/.pyenv/versions/{name}/` | Shim binaries | Global default + per-project override |
| **Docker context** | `~/.docker/contexts/{name}/` | `docker context use` | Simple `use` cmd, metadata file |

---

## 3. Switching Mechanism Options

| Approach | Pros | Cons | Risk |
|----------|------|------|------|
| **A. Symlink entire `~/.claude`** | Simplest | Breaks runtime data | HIGH |
| **B. Symlink individual config files** | Surgical, preserves runtime | More files to manage | LOW |
| **C. Copy files on switch** | Safest | Loses live-edit; slower | LOW |
| **D. Hybrid (symlink dirs, copy files)** | Best of B+C | Slightly more complex | LOW |

### Recommendation: Option D (Hybrid)
- **Symlink** items already symlinked or directories: `rules/`, `hooks/`, `skills/`, `agents/`, `CLAUDE.md`, `statusline.cjs`, `.luna.json`
- **Copy** mutable config files: `settings.json`, `.env`, `.credentials.json`, `.ck.json`
- **Why:** Claude Code may overwrite `settings.json` in-place; symlinked dirs already the established pattern

---

## 4. Proposed Architecture

```
~/.claude-profiles/
├── .active                    # Contains active profile name
├── profiles.json              # Profile metadata + manifest
├── default/
│   ├── settings.json          # Copied on save
│   ├── .env, .credentials.json, .ck.json
│   ├── source.json            # Records symlink targets (see below)
│   └── commands/              # Copied directory
├── work/
└── personal/
```

`source.json` — records where symlinks point:
```json
{
  "CLAUDE.md": "/path/to/.agents/CLAUDE.md",
  "rules": "/path/to/.agents/rules",
  "hooks": "/path/to/.agents/hooks",
  "skills": "/path/to/.agents/skills",
  "agents": "/path/to/.agents/agents"
}
```

### Switch flow:
1. Save current: copy mutable files + record symlink targets to active profile
2. Remove managed symlinks/files from `~/.claude/`
3. Restore target: recreate symlinks + copy files back
4. Update `.active` marker

---

## 5. CLI Framework Recommendation

| Framework | Pros | Cons |
|-----------|------|------|
| **Node.js + Commander** | Native JSON, npm publish, ecosystem match | Requires Node |
| **Bash script** | Zero deps, fast | Hard to maintain, no JSON parsing |
| **Go** | Single binary, fast | Overkill for this |

**Winner: Node.js + Commander** — ecosystem alignment (Claude Code is Node), native JSON, easy `npm i -g`, cross-platform fs operations. Binary name: `csp` (claude-switch-profile).

---

## 6. Proposed CLI Commands

```
csp list                         # List profiles (* = active)
csp use <name>                   # Switch to profile
csp create <name>                # Create from current state
csp create <name> --from <other> # Clone existing profile
csp current                      # Show active profile
csp export <name> <file>         # Export as .tar.gz
csp import <file> [name]         # Import profile
csp delete <name>                # Remove (with confirmation)
csp diff <a> <b>                 # Diff two profiles
csp save                         # Save current state to active profile
```

---

## 7. Safety Considerations

1. **Backup before switch** — auto-copy current state to `~/.claude-profiles/.backup/`
2. **Whitelist only** — never touch runtime dirs, only manage known config files
3. **Validate** — ensure target profile exists and has required files
4. **Lock file** — prevent concurrent switches
5. **Dry-run** — `csp use work --dry-run` shows what would change
6. **Session check** — warn if Claude Code is running (check process list)

---

## Unresolved Questions

1. Does Claude Code watch `settings.json` for live changes or only read on startup?
2. Should `plugins/` be profile-switchable? (marketplace cache vs plugin config)
3. Should `.credentials.json` be per-profile (different accounts) or shared (same user)?
4. Support auto-switching via `.claude-profile` in project dirs (like `.nvmrc`)?
