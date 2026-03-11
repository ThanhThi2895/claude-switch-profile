# Claude Code Configuration Structure Research

**Date:** 2026-03-11
**Purpose:** Understand what constitutes a "profile" in Claude Code for building a profile switcher

## 1. ~/.claude/ Directory Structure

### User-Configurable Files (PROFILE-RELEVANT)

| File/Dir | Type | Purpose | Swap? |
|---|---|---|---|
| `CLAUDE.md` | **symlink** -> `.agents/CLAUDE.md` | Global system prompt, role, skills catalog, workflows | YES |
| `settings.json` | regular file | Hooks, model, env vars, plugins, statusline, permissions | YES |
| `.ck.json` | regular file | ClaudeKit config: plan naming, locale, paths, trust, kits | YES |
| `.luna.json` | **symlink** -> project `.luna.json` | Luna-specific: plan validation, paths, locale, hooks toggles | YES |
| `rules/` | **symlink** -> `.agents/rules/` | Development rules, workflows, orchestration, team coordination (6 .md files) | YES |
| `agents/` | **symlink** -> `.agents/agents/` | Agent persona definitions (researcher, planner, tester, etc. — 12 .md files) | YES |
| `skills/` | **symlink** -> `.agents/skills/` | 38+ skill directories (cook, fix, research, gkg, etc.) | YES |
| `hooks/` | **symlink** -> `.agents/hooks/` | Hook scripts (session-init, privacy-block, scout-block, etc. — 16 .cjs files) | YES |
| `statusline.cjs` | **symlink** -> `.agents/statusline.cjs` | Custom statusline renderer | YES |
| `.env` | regular file | API keys (Gemini, Anthropic, OpenAI, ClickUp, Jira, Asana, Discord, Telegram) | YES |
| `.ckignore` | regular file | Size-based directory blocking (node_modules, .venv, etc.) | MAYBE |
| `commands/` | dir (empty) | Custom slash commands | YES |
| `teams/` | dir | Team configurations (`default/config.json`, inboxes) | YES |
| `plugins/` | dir | Plugin registry (installed_plugins.json, marketplaces) | YES |

### Auto-Generated / Ephemeral (DO NOT SWAP)

| File/Dir | Purpose |
|---|---|
| `.credentials.json` | Auth tokens (sensitive, per-user) |
| `projects/` | Per-project session history, task files (auto-created by path hash) |
| `backups/` | Auto-backup of .claude.json |
| `cache/` | Runtime cache |
| `debug/` | Debug logs |
| `telemetry/` | Usage telemetry |
| `shell-snapshots/` | Shell state snapshots |
| `paste-cache/` | Clipboard cache |
| `file-history/` | File edit history |
| `ide/` | IDE integration state |
| `session-env/` | Session environment vars |
| `todos/`, `tasks/` | Runtime task tracking |
| `agent-memory/` | Agent memory persistence |
| `history.jsonl` | Command history |
| `plans/` | Plan storage (within ~/.claude, not project) |

### Root-Level Config

| File | Purpose | Swap? |
|---|---|---|
| `~/.claude.json` | Master state: per-project allowedTools, mcpServers, trust, metrics, session history | PARTIAL |

## 2. Symlink Architecture (Current State)

Already 6 symlinks in `~/.claude/` pointing to a single source project:

```
~/.claude/CLAUDE.md      -> ai-auto-project/.agents/CLAUDE.md
~/.claude/rules/         -> ai-auto-project/.agents/rules/
~/.claude/agents/        -> ai-auto-project/.agents/agents/
~/.claude/skills/        -> ai-auto-project/.agents/skills/
~/.claude/hooks/         -> ai-auto-project/.agents/hooks/
~/.claude/statusline.cjs -> ai-auto-project/.agents/statusline.cjs
~/.claude/.luna.json     -> ai-auto-project/.luna.json
```

This means the current setup is already profile-like: a single `.agents/` directory IS the profile source.

## 3. Project-Level vs Global Config

| Level | File | Scope |
|---|---|---|
| **Global** | `~/.claude/CLAUDE.md` | Injected into ALL sessions as system prompt |
| **Global** | `~/.claude/settings.json` | Hooks, model, env vars for all projects |
| **Project** | `<project>/.claude/settings.local.json` | Per-project permissions, overrides |
| **Project** | `<project>/CLAUDE.md` | Project-specific instructions (merged with global) |
| **Project** | `<project>/.mcp.json` | Project-specific MCP servers |
| **Per-project in ~/.claude.json** | `projects[path].mcpServers` | MCP servers configured via Claude UI |
| **Per-project in ~/.claude.json** | `projects[path].allowedTools` | Tool permissions granted per project |

## 4. What Defines a "Profile"

A profile = the complete agent kit/persona. Components to swap:

### Tier 1 — Core Identity (MUST swap)
1. **CLAUDE.md** — system prompt, role, skills catalog
2. **settings.json** — hooks config, model, env vars, statusline, plugins
3. **rules/** — development rules, workflows
4. **agents/** — agent persona definitions
5. **skills/** — available skill set
6. **hooks/** — hook scripts that enforce behavior

### Tier 2 — Supporting Config (SHOULD swap)
7. **.ck.json** — ClaudeKit config (plan naming, locale, kits)
8. **.luna.json** — Luna-specific settings
9. **statusline.cjs** — custom statusline
10. **.env** — API keys (optional, some users share across profiles)
11. **commands/** — custom slash commands
12. **.ckignore** — directory blocking rules

### Tier 3 — Optional (project-specific, usually NOT swapped)
13. **teams/** — team configurations
14. **plugins/** — plugin registry
15. **~/.claude.json projects[].mcpServers** — per-project MCP servers

## 5. Profile Switching Strategy

### Recommended: Symlink Redirection (matches current architecture)

```
~/.claude/profiles/
├── luna-engineer/          # Profile 1
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── .ck.json
│   ├── rules/
│   ├── agents/
│   ├── skills/
│   ├── hooks/
│   ├── statusline.cjs
│   ├── .env
│   └── commands/
├── minimal/                # Profile 2 (barebones)
│   └── ...
└── custom-team/            # Profile 3
    └── ...
```

**Switch operation:** Replace symlinks in `~/.claude/` to point at selected profile dir.

**Advantages:**
- Already proven pattern (6 symlinks exist today)
- Atomic swap (update symlinks, restart session)
- Profiles are self-contained, versionable, shareable
- No file copying needed

**Alternative: Source-based profiles** — each profile points to a different `.agents/` directory (could be in different repos). Same symlink swap, different source.

## 6. Key Constraints

- `~/.claude.json` is a monolith — contains per-project state mixed with global config. Swapping entirely would lose project history/permissions. Need selective merge or leave untouched.
- `.credentials.json` should NEVER be swapped (auth tokens).
- `settings.json` contains both profile-relevant (hooks, model) and session-relevant (permissions cache) data. May need selective swap.
- Claude Code reads `~/.claude/` at session start — profile switch requires new session or `/clear`.
- `.env` may contain shared API keys — consider inheritance (global `.env` + profile `.env.profile`).

## Unresolved Questions

1. Does Claude Code watch `~/.claude/` for changes mid-session, or only reads at startup?
2. Can `settings.json` be split or does it need to be a single file?
3. Should `.env` be shared across profiles or profile-specific? (user preference)
4. How to handle `~/.claude.json` per-project mcpServers — profile-scoped or always preserved?
5. Should profiles support inheritance (base profile + overrides)?
