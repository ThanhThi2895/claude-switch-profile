# Claude Switch Profile (CSP)

[![npm version](https://img.shields.io/npm/v/claude-switch-profile)](https://www.npmjs.com/package/claude-switch-profile)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**GitHub:** https://github.com/ThanhThi2895/claude-switch-profile

A CLI tool for managing multiple Claude Code configurations and profiles. Use legacy global switching (`csp use`) or concurrent isolated account sessions (`csp launch`) with per-profile runtime roots.

## Overview

Claude Switch Profile enables developers to maintain multiple isolated Claude Code environments on a single machine. Each profile captures and restores:

- **Symlinked items** (rules, agents, skills, hooks, CLAUDE.md, etc.) — point to external repositories
- **Mutable files** (settings.json, .env, .ck.json, etc.) — copied and restored per profile
- **Custom directories** (commands, plugins) — copied and restored per profile

Profiles are stored in `~/.claude-profiles/` and are never managed by Claude Code itself, ensuring clean separation and safe switching.

## Installation

CSP distributes using decoupled local installations. This ensures your `csp` command doesn't spontaneously break or disappear when switching Node compilation environments via managers like `nvm` or `fnm`.

**Requirements:** Node.js >= 18.0.0 | macOS/Linux/Windows 10+

### Option 1: Standalone Bash Installer (Recommended)

Creates an isolated environment untouched by NVM lifecycle changes (Supports macOS, Linux, and Windows Git Bash):

```bash
curl -fsSL https://raw.githubusercontent.com/ThanhThi2895/claude-switch-profile/main/install.sh | bash
```

*Note: The script safely creates a resilient executable wrapper at `~/.local/bin/csp`. Please ensure `~/.local/bin` is in your `$PATH`.*

### Option 2: Homebrew (macOS / Linux)

Leverages Homebrew's own managed cellars to isolate the Node engine:

```bash
brew tap ThanhThi2895/claude-switch-profile https://github.com/ThanhThi2895/claude-switch-profile
brew install claude-switch-profile
```

If you previously hit a tap resolution error, reset then tap again:

```bash
brew untap ThanhThi2895/claude-switch-profile 2>/dev/null || true
brew tap ThanhThi2895/claude-switch-profile https://github.com/ThanhThi2895/claude-switch-profile
brew install claude-switch-profile
```

### Option 3: Global NPM (Legacy Fallback)

⚠️ **Not Recommended:** Global installs tie the tool to your *current* Node version. The `csp` command will disappear from `$PATH` if you change node versions.

```bash
npm install -g claude-switch-profile
```

## Uninstall

`csp uninstall` only removes the **CLI tool**. It does **not** delete any profile data.

- Profiles stay at `~/.claude-profiles/`
- Your `~/.claude` config is not mutated by this command

Choose uninstall method that matches how you installed CSP:

```bash
# npm global install
csp uninstall --method npm
# then run:
npm uninstall -g claude-switch-profile

# Homebrew install
csp uninstall --method brew
# then run:
brew uninstall claude-switch-profile

# Standalone install.sh
csp uninstall --method standalone
# this removes ~/.local/bin/csp and ~/.csp-cli directly
```

Use `--force` to skip confirmation.

## Quick Start

```bash
# 1. Initialize — capture current setup as "default" profile
csp init

# 2. Create additional profiles
csp create work -d "Work setup with company rules"
csp create experimental --from default -d "Testing new tools"

# 3. Launch isolated sessions (recommended — does NOT touch ~/.claude)
csp launch work
csp launch experimental

# 4. Or use the interactive selector
csp
```

## Core Commands

| Command | Description |
|---|---|
| `csp` / `csp select` | Interactive profile selector (default) |
| `csp init` | Initialize and capture current state as `default` profile |
| `csp create <name>` | Create a new profile (`--from`, `--source`, `-d` options) |
| `csp launch <name>` | Launch isolated Claude session for a profile |
| `csp exec <name> -- <cmd>` | Run any command inside isolated profile runtime |
| `csp use <name>` | Legacy global switch (mutates `~/.claude`) |
| `csp save` | Save current state to active profile |
| `csp list` / `csp ls` | List all profiles |
| `csp status` | Show CSP status dashboard |
| `csp current` | Show active legacy profile |
| `csp toggle` | Quick-switch to previous profile |
| `csp diff <a> <b>` | Compare two profiles |
| `csp export <name>` | Export profile as `.tar.gz` archive |
| `csp import <file>` | Import profile from archive |
| `csp delete <name>` | Delete a profile |
| `csp deactivate` | Switch back to `default` profile |
| `csp uninstall --method <npm\|brew\|standalone>` | Uninstall csp CLI and keep all profiles |

> 📖 **Full command reference with all options and detailed behavior:** [docs/commands-reference.md](docs/commands-reference.md)

## Two Launch Modes

### Isolated Launch (recommended)

```bash
csp launch work
csp launch work --dangerously-skip-permissions
csp la dev --model opus
```

- Does **not** mutate `~/.claude` or change `.active`
- Creates per-profile runtime at `~/.claude-profiles/.runtime/<name>`
- Spawns Claude with `CLAUDE_CONFIG_DIR` pointing to runtime root
- Supports `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` env resolution

### Legacy Global Switch

```bash
csp use work
# Restart Claude Code for changes to take effect
```

- Mutates `~/.claude` directly
- Updates `.active` marker
- Requires Claude restart

## How Profiles Work

### Profile Storage

```
~/.claude-profiles/
├── .active                    # Current active profile name (legacy)
├── profiles.json              # Metadata for all profiles (v2 schema)
├── .runtime/                  # Isolated launch roots
│   ├── work/
│   └── personal/
├── default/
│   ├── source.json           # Managed item map
│   ├── settings.json         # Copied from ~/.claude
│   ├── .env                  # Copied from ~/.claude
│   └── ...
└── production/
    ├── source.json
    └── ...
```

### What Gets Managed

| Category | Items |
|---|---|
| **Managed Static** | `CLAUDE.md`, `rules/`, `agents/`, `skills/`, `hooks/`, `statusline.*`, `.luna.json` |
| **Copied Files** | `settings.json`, `.env`, `.ck.json`, `.ckignore`, `.mcp.json`, `.gitignore`, etc. |
| **Copied Dirs** | `commands/`, `plugins/`, `workflows/`, `scripts/`, `output-styles/`, `schemas/` |
| **Never Touched** | `.credentials.json`, `projects/`, `sessions/`, `cache/`, `telemetry/`, etc. |

## Safety Features

- **Lock file** — prevents concurrent profile switches (PID-based, auto-detects stale locks)
- **Claude process detection** — warns when Claude is running during switch
- **Import validation** — rejects unsafe symlinks pointing outside profile tree
- **Profile validation** — checks structure before applying
- **Auto-backups** — created before destructive operations

## Workflow Examples

### Work vs. Personal

```bash
csp init
csp create work -d "Work environment"
csp create personal -d "Personal projects"

# Launch whichever you need
csp launch work
csp launch personal
```

### Backup and Restore

```bash
csp export production -o ~/backups/production-2026-03.tar.gz
csp import ~/backups/production-2026-03.tar.gz -n production-restored
```

### Share with Team

```bash
csp export my-setup -o ./my-setup.csp.tar.gz
# Teammate:
csp import my-setup.csp.tar.gz -n shared-team-setup
```

## Documentation

- [Commands Reference](docs/commands-reference.md) — Full command options, behavior, and troubleshooting
- [System Architecture](docs/system-architecture.md) — Module architecture, data flows, and internals
- [Project Overview](docs/project-overview-pdr.md) — Product design review and requirements
- [Code Standards](docs/code-standards.md) — Coding conventions and guidelines
- [Changelog](CHANGELOG.md) — Version history and migration guidance

## License

MIT

## Contributing

Contributions welcome! See the [docs/](docs/) for architecture and code standards.
