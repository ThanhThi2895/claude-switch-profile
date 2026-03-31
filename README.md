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

### Global Installation

```bash
npm install -g claude-switch-profile
```

Then use the `csp` command globally:

```bash
csp list
csp current
csp create my-profile
```

### Local Development

```bash
# In the project root
npm install
npm link

# Now available as `csp` command
csp --help
```

### Requirements

- Node.js >= 18.0.0
- Unix/Linux/macOS
- Windows 10+

## Quick Start

### 1. Initialize

Capture your current Claude Code setup as the physical `default` profile snapshot:

```bash
csp init
```

This creates `~/.claude-profiles/default/` from the current managed contents of `~/.claude`. Protected and session/runtime files remain excluded.

### 2. Create Additional Profiles

Create a new profile from your current state:

```bash
csp create work --description "Work setup with company rules"
```

Or clone from an existing profile:

```bash
csp create experimental --from default --description "Testing new tools"
```

### 3. Switch Between Profiles

Switch to a profile (automatically saves current state):

```bash
csp use work
# Restart your Claude Code session for changes to take effect
```

Use `--dry-run` to preview changes:

```bash
csp use work --dry-run
```

### 4. Save Current State

Save the active profile with current configuration:

```bash
csp save
```

### 5. List All Profiles

View all available profiles with their status:

```bash
csp list
```

Output example:

```
 * default — Vanilla Claude defaults (2026-03-11)
   work — Work setup (2026-03-11)
   experimental (2026-03-11)
```

The `*` marks the active profile.

### 6. Launch via Interactive Selector (Default Command)

Run `csp` without a subcommand to open the interactive selector and launch a profile immediately:

```bash
csp
```

### 7. Uninstall CSP

Remove CSP and restore your Claude Code to its original state:

```bash
csp uninstall
# Uninstall CSP and remove all profiles? This cannot be undone. (y/N)
```

## Commands Reference

### select (default)

Open interactive profile selector (default behavior when you run `csp` without subcommand).

```bash
csp
csp select
```

**Behavior:**
- If TTY and multiple profiles exist: shows arrow-key menu and launches selected profile via `csp launch <name>`
- If only one profile exists: shows informational message and exits
- If non-interactive terminal: asks to use `csp launch <name>` or `csp use <name>` directly

---

### init

Initialize the profile system and capture current state as "default" profile.

```bash
csp init
```

**Options:** None

**Behavior:**
- Creates `~/.claude-profiles/` directory
- Captures current `~/.claude` configuration
- Creates `default` profile and marks it active
- If already initialized, displays current active profile

---

### current

Display the currently active **legacy** profile and isolated launch metadata (if present).

```bash
csp current
```

**Output:**
```
✓ Active legacy profile: default
ℹ Location: /home/user/.claude-profiles/default
ℹ Last isolated launch: 2026-03-26T14:45:00.000Z
ℹ Isolated runtime: /home/user/.claude-profiles/.runtime/default
```

---

### list (ls)

List all profiles with descriptions and creation dates.

```bash
csp list
csp ls
```

**Output format:**
```
 * profile-name — optional description (YYYY-MM-DD) [legacy|account-session]
   other-profile (YYYY-MM-DD) [account-session]
```

The `*` marks the currently active profile.

---

### status

Show CSP status dashboard (active profile, profile count, last launch, Claude process state).

```bash
csp status
```

---

### create

Create a new profile from current state or clone existing profile.

```bash
csp create <name> [options]
```

**Options:**
- `--from <profile>` — Clone from existing profile instead of current state
- `-s, --source <path>` — Create from a specific kit directory, then inherit missing managed items from current `~/.claude`
- `-d, --description <text>` — Add description to profile

**Examples:**

Create from current state:
```bash
csp create production
```

Create with description:
```bash
csp create staging -d "Staging environment with logging enabled"
```

Clone from existing:
```bash
csp create backup --from production
```

Create from kit directory:
```bash
csp create team-kit --source ~/my-kit/.agents -d "Team baseline"
```

**Behavior:**
- Creates profile directory: `~/.claude-profiles/<name>/`
- If `--from` is specified, clones all content from source profile
- If `--source` is specified, copies managed items from that directory, then fills missing managed items from current `~/.claude`
- Otherwise, performs full clone of current `~/.claude` excluding protected/session items
- If this is the first profile, automatically sets it as active
- Saves metadata (created timestamp, description)

---

### save

Save the current `~/.claude` state to the active profile.

```bash
csp save
```

**Behavior:**
- Captures all managed items and copied files/directories from `~/.claude`
- Overwrites the active profile snapshot (`source.json` plus copied content)
- When `default` is active, updates the physical `default` snapshot like any other profile
- Protected and session/runtime files remain excluded
- Requires an active profile

---

### use

Switch to a different profile.

```bash
csp use <name> [options]
```

**Options:**
- `--dry-run` — Show what would change without executing
- `--no-save` — Skip saving current profile before switching

**Examples:**

Simple switch:
```bash
csp use production
```

Preview changes first:
```bash
csp use staging --dry-run
```

Switch without saving current state:
```bash
csp use backup --no-save
```

**Behavior:**
1. Validates target profile exists and profile structure is valid
2. Refuses to switch while Claude Code is running (legacy/global switching mutates `~/.claude` directly)
3. If the active profile exists and `--no-save` is not set: saves its current snapshot first
4. Removes managed items/files from `~/.claude`
5. Restores the target profile snapshot into `~/.claude` — including `default`
6. Updates active marker
7. On older installs missing `profiles/default`, CSP only backfills that snapshot when the active profile is `default` or no active profile is set; otherwise it fails closed with repair guidance
8. **Important:** Claude Code session must be restarted for changes to apply

---

### toggle

Launch the previous profile (does not mutate global active profile in isolated mode).

```bash
csp toggle
```

**Behavior:**
- Reads previous profile marker from `~/.claude-profiles/.previous`
- Validates previous profile still exists
- Delegates to `csp launch <previous>`

---

### delete (rm)

Delete a profile.

```bash
csp delete <name> [options]
csp rm <name> [options]
```

**Options:**
- `-f, --force` — Skip confirmation prompt

**Examples:**

Delete with confirmation:
```bash
csp delete experimental
# Delete profile "experimental"? This cannot be undone. (y/N)
```

Force delete without prompt:
```bash
csp delete old-setup --force
```

**Behavior:**
- Cannot delete `default`
- Prompts for confirmation unless `--force` is used
- Permanently removes profile directory and metadata
- If deleting the currently active non-default profile: clears active marker only (does not mutate `~/.claude`)
- Cannot be undone

---

### export

Export a profile as a compressed tar.gz archive.

```bash
csp export <name> [options]
```

**Options:**
- `-o, --output <path>` — Output file path (defaults to `./{name}.csp.tar.gz`)

**Examples:**

Export with default filename:
```bash
csp export production
# Exports to ./production.csp.tar.gz
```

Export to custom location:
```bash
csp export staging -o ~/backups/claude-staging.tar.gz
```

**Behavior:**
- Creates tar.gz archive of the profile snapshot directory
- Includes `source.json` plus copied profile files/directories
- Exporting `default` works like any other profile snapshot
- Protected and session/runtime files remain excluded from the archive
- Useful for backup, sharing, or version control

---

### import

Import a profile from tar.gz archive.

```bash
csp import <file> [options]
```

**Options:**
- `-n, --name <name>` — Profile name (defaults to archive filename without extension)
- `-d, --description <text>` — Profile description

**Examples:**

Import with default name:
```bash
csp import production.csp.tar.gz
# Creates profile named "production"
```

Import with custom name and description:
```bash
csp import backup.tar.gz -n restored -d "Restored from backup"
```

**Behavior:**
- Extracts archive to `~/.claude-profiles/<name>/`
- Uses filename as profile name if `--name` not specified
- Validates imported profile structure
- Rejects import if managed/copied items contain symlink targets outside profile directory (safety check)
- Creates metadata entry for profile
- Profile is ready to use immediately

---

### diff

Compare two profiles to identify differences.

```bash
csp diff <profileA> <profileB>
```

**Special:** Use `current` to compare against active profile.

**Examples:**

Compare two profiles:
```bash
csp diff staging production
```

Compare current profile with another:
```bash
csp diff current backup
```

**Output:**
```
Comparing: staging ↔ production

Managed item map (source.json): identical

File differences:
  settings.json — different
  .env — only in production
  rules/CLAUDE.md — different
```

**Behavior:**
- Compares `source.json` (managed item map)
- Lists file presence and content differences
- Shows which files differ and in which profile they exist

---

### deactivate

Deactivate the currently active non-default profile by switching back to the physical `default` snapshot.

```bash
csp deactivate
```

**Options:**
- `--no-save` — Skip saving current profile state before deactivation

**Behavior:**
1. Exits early if no active profile or active profile is `default`
2. Delegates to `csp use default`
3. Optionally saves the current non-default profile state
4. Restores the physical `default` snapshot into `~/.claude`
5. Marks `default` as the active legacy profile

---

### launch (la)

Launch an isolated Claude session for a profile. This does **not** change global active profile. All extra arguments are forwarded to `claude`.

```bash
csp launch <name> [claude-args...]
csp la <name> [claude-args...]
```

**Options:**
- `--legacy-global` — Use old behavior (`csp use <name>` then launch)

**Examples:**

Launch isolated session:
```bash
csp launch work
```

Launch isolated with Claude flags:
```bash
csp launch work --dangerously-skip-permissions
csp la dev --model opus
```

Launch legacy/global mode:
```bash
csp launch work --legacy-global
```

**Behavior (default isolated mode):**
1. Validates target profile exists
2. Ensures the profile snapshot exists; for legacy installs missing `default/`, guarded backfill only runs when the active profile is `default` or no active profile is set
3. Prepares per-profile runtime under `~/.claude-profiles/.runtime/<name>`
4. Resolves effective allowlisted `ANTHROPIC_*` launch env (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`) with precedence: `settings.json env` > profile `.env` allowlist > parent process env
5. Strips inherited `CLAUDECODE`, inherited `CLAUDE_CONFIG_DIR`, inherited `ANTHROPIC_*`, and Claude session env vars before applying resolved allowlisted values
6. Spawns `claude` with `CLAUDE_CONFIG_DIR=<runtimeDir>`
7. Inherits stdin/stdout/stderr for interactive use
8. Forwards Claude's exit code
9. Keeps `.active` unchanged and never mutates global `~/.claude`
10. Launching `default` preserves its `legacy` mode metadata even though it uses an isolated runtime snapshot

`ANTHROPIC_*` keys currently in isolated launch scope:
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`

Set `CSP_DEBUG_LAUNCH_ENV=1` to print extended launch diagnostics. Do not use in shared logs because it can include resolved `ANTHROPIC_*` values.

---

### exec

Run an arbitrary command inside isolated profile runtime env. This does **not** change global active profile.

```bash
csp exec <name> -- <command> [args...]
```

**Examples:**

Run any CLI tool with profile runtime env:
```bash
csp exec work -- env
csp exec work -- node scripts/check-env.js
```

Run a shell function/alias defined by your interactive shell:
```bash
csp exec hd -- claude-hd2
```

**Behavior:**
1. Validates target profile exists
2. Ensures the profile snapshot exists; for legacy installs missing `default/`, guarded backfill only runs when the active profile is `default` or no active profile is set
3. Prepares per-profile runtime under `~/.claude-profiles/.runtime/<name>`
4. Resolves effective allowlisted `ANTHROPIC_*` launch env (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`) with precedence: `settings.json env` > profile `.env` allowlist > parent process env
5. Strips inherited `CLAUDECODE`, inherited `CLAUDE_CONFIG_DIR`, inherited `ANTHROPIC_*`, and Claude session env vars before applying resolved allowlisted values
6. On Unix-like systems, runs the command through your interactive shell so shell functions/aliases can resolve like a normal terminal command; on Windows, keeps direct spawn behavior with `.cmd` / `.bat` wrapper detection
7. Reasserts `CLAUDE_CONFIG_DIR` and allowlisted `ANTHROPIC_*` after shell init so profile isolation wins over shell startup overrides
8. Inherits stdin/stdout/stderr and forwards child exit code
9. Keeps `.active` unchanged and never mutates global `~/.claude`

---

### uninstall

Remove all profiles and restore Claude Code to its pre-CSP state.

```bash
csp uninstall
```

**Options:**
- `-f, --force` — Skip confirmation prompt
- `--profile <name>` — Restore a specific profile instead of the active one

**Examples:**

Uninstall with confirmation:
```bash
csp uninstall
# Uninstall CSP and remove all profiles? This cannot be undone. (y/N)
```

Restore a specific profile during uninstall:
```bash
csp uninstall --profile production
```

Force uninstall without prompt:
```bash
csp uninstall --force
```

**Behavior:**
1. Creates a final backup at `~/.claude-profiles/.backup/`
2. Restores the active profile by default, or the `--profile` choice, to `~/.claude`
3. If `default` is restored, it uses the physical `default` snapshot like any other profile
4. Removes `~/.claude-profiles/` entirely
5. Prints reminder to run `npm uninstall -g claude-switch-profile`

---

## How Profiles Work

### Profile Storage

Profiles are stored in `~/.claude-profiles/`:

```
~/.claude-profiles/
├── .active                    # Current active profile name (legacy use mode)
├── profiles.json              # Metadata for all profiles (v2 schema)
├── .runtime/                  # Isolated launch roots
│   ├── work/
│   └── personal/
├── default/
│   ├── source.json           # Managed item map
│   ├── settings.json         # Copied from ~/.claude
│   ├── .env                  # Copied from ~/.claude
│   ├── .ck.json              # Copied from ~/.claude
│   ├── .ckignore             # Copied from ~/.claude
│   ├── commands/             # Copied from ~/.claude
│   └── plugins/              # Copied from ~/.claude
└── production/
    ├── source.json
    ├── settings.json
    └── ...
```

### What Gets Managed

**Managed Static Items** (via `source.json`):
- `CLAUDE.md` — Project-specific Claude configuration
- `rules/` — Development rules and guidelines
- `agents/` — Agent scripts and configurations
- `skills/` — Custom Luna skills
- `hooks/` — Pre/post action hooks
- `statusline.cjs`, `statusline.sh`, `statusline.ps1` — Custom statusline scripts
- `.luna.json` — Luna configuration

**Copied Files**:
- `settings.json` — Editor settings
- `.env`, `.env.example` — Environment variables
- `.ck.json`, `.ckignore` — Custom settings and ignore patterns
- `.mcp.json`, `.mcp.json.example` — MCP configuration
- `.gitignore` — Local ignore settings

**Copied Directories**:
- `commands/`, `plugins/` — Custom commands/plugins
- `workflows/`, `scripts/` — Automation and workflow assets
- `output-styles/`, `schemas/` — Output and schema assets

**Never Touched** (runtime/session data):
- `.credentials.json`
- `projects/`, `sessions/`, `session-env/`, `ide/`
- `cache/`, `paste-cache/`, `downloads/`, `telemetry/`, `debug/`, `statsig/`
- `history.jsonl`, `metadata.json`, `stats-cache.json`, `active-plan`
- `backups/`, `command-archive/`, `commands-archived/`
- `plans/`, `todos/`, `tasks/`, `teams/`, `agent-memory/`, `file-history/`, `shell-snapshots/`
- All other protected or session-specific data

### Legacy vs Isolated Launch Modes

CSP now supports two paths:

- **Legacy global mode (`csp use`)**
  - Mutates `~/.claude`
  - Updates `.active`
  - Preserves old behavior for existing scripts

- **Isolated launch mode (`csp launch`)**
  - Does not mutate `~/.claude`
  - Does not change `.active`
  - Creates/updates runtime root per profile at `~/.claude-profiles/.runtime/<name>`
  - Launches Claude with `CLAUDE_CONFIG_DIR` pointing to that runtime root

### Runtime Sync Policy (isolated launch)

For each launch, CSP syncs static profile config into runtime root:

- Managed items (`CLAUDE.md`, `rules`, `agents`, `skills`, `hooks`, statusline files, `.luna.json`)
- Copied files (`settings.json`, `.env`, `.ck.json`, `.ckignore`, etc.)
- Copied directories (`commands`, `plugins`, `workflows`, `scripts`, ...)

Runtime/account continuity stays isolated per runtime root and is not globally swapped.

## Safety Features

### Lock File

Prevents concurrent profile switches:
- Created at `~/.claude-profiles/.lock` during operations
- Contains process ID (PID) of the running operation
- Auto-detects stale locks (process no longer running)
- Throws error if another switch is in progress

```
Another csp operation is running (PID: 12345).
Remove ~/.claude-profiles/.lock if stale.
```

### Claude Process Detection

When switching profiles, CSP detects if Claude Code is running:

```
⚠ Claude Code appears to be running. Restart your Claude session after switching profiles.
```

**Important:** Changes only take effect after restarting Claude Code.

### Windows Support

Process detection uses `tasklist` instead of `pgrep` on Windows.

Export/import commands use the built-in `tar.exe` available on Windows 10+.

### Validation

Before switching, CSP validates:
1. Target profile exists
2. Profile structure is valid

During import, CSP also validates profile contents and rejects unsafe symlinks that point outside the imported profile tree.

## Configuration via Environment Variables

Override default behavior for testing or advanced use:

### CSP_HOME

Override the home directory (default: `process.env.HOME`).

```bash
CSP_HOME=/tmp/test csp list
```

### CSP_CLAUDE_DIR

Override Claude config directory (default: `~/.claude`).

```bash
CSP_CLAUDE_DIR=/tmp/test-claude csp init
```

### CSP_PROFILES_DIR

Override profiles storage directory (default: `~/.claude-profiles`).

```bash
CSP_PROFILES_DIR=/tmp/test-profiles csp list
```

**Use case:** Testing in isolated environments without affecting your real configuration.

## Workflow Examples

### Scenario 1: Work vs. Personal

```bash
# Initial setup
csp init

# Create work profile
csp create work -d "Work environment with company rules"
# ... modify rules, settings, etc. ...
csp save

# Create personal profile
csp use default
csp create personal -d "Personal projects"
csp save

# Switch between them
csp use work      # Switch to work
csp use personal  # Switch to personal
```

### Scenario 2: Testing New Tools

```bash
# Clone current profile
csp create experimental --from default -d "Testing new Luna skills"

# Switch and experiment
csp use experimental
# ... install new skills, modify rules ...
csp save

# If good, merge back to default
csp diff current default
# ... review differences ...
csp use default
# ... copy changes manually or recreate ...

# Clean up
csp delete experimental
```

### Scenario 3: Backup and Restore

```bash
# Backup production profile
csp export production -o ~/backups/production-2026-03.tar.gz

# ... time passes ...

# Restore if needed
csp import ~/backups/production-2026-03.tar.gz -n production-restored
csp use production-restored
```

### Scenario 4: Share Profile with Team

```bash
# Export your setup
csp export my-setup -o ./my-setup.csp.tar.gz

# Teammate imports
csp import my-setup.csp.tar.gz -n shared-team-setup
csp use shared-team-setup
```

## Troubleshooting

### No active profile

**Error:** `No active profile. Run "csp create <name>" first.`

**Solution:** Initialize with `csp init` to create the default profile.

```bash
csp init
```

### Profile doesn't exist

**Error:** `Profile "name" does not exist. Run "csp list" to see available profiles.`

**Solution:** Check available profiles and use exact name.

```bash
csp list
csp use production  # if "production" exists
```

### Cannot delete default profile

**Error:** `Cannot delete the default profile.`

**Solution:** Keep `default` and delete only non-default profiles.

```bash
csp delete experimental
```

### Stale lock file

**Error:** `Another csp operation is running (PID: 12345). Remove ~/.claude-profiles/.lock if stale.`

**Solution:** If the process is not running, manually remove the lock:

```bash
rm ~/.claude-profiles/.lock
```

### Invalid profile structure

**Error:** `Profile "name" is invalid: Missing source.json — no managed items defined`

**Solution:** Recreate the profile or import a valid profile archive.

### Changes not applying

**Issue:** Switched profiles but changes don't appear in Claude Code.

**Solution:** Restart Claude Code session after switching.

```bash
csp use staging
# Close and restart Claude Code
```

## Development

### Run Tests

```bash
npm test                # All tests
npm run test:core       # Core library tests
npm run test:cli        # CLI integration tests
npm run test:safety     # Safety feature tests
```

### Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and migration guidance.

### Project Structure

```
.
├── bin/
│   └── csp.js                    # CLI entry point
├── src/
│   ├── commands/                 # Command implementations
│   │   ├── init.js
│   │   ├── current.js
│   │   ├── list.js
│   │   ├── status.js
│   │   ├── create.js
│   │   ├── save.js
│   │   ├── use.js
│   │   ├── toggle.js
│   │   ├── delete.js
│   │   ├── export.js
│   │   ├── import.js
│   │   ├── diff.js
│   │   ├── select.js
│   │   ├── launch.js
│   │   ├── deactivate.js
│   │   └── uninstall.js
│   ├── constants.js              # Configuration constants
│   ├── platform.js               # Cross-platform compatibility
│   ├── profile-store.js          # Profile metadata management
│   ├── runtime-instance-manager.js # Isolated runtime sync
│   ├── item-manager.js           # Managed item copy/move operations
│   ├── file-operations.js        # File copy/restore operations
│   ├── launch-effective-env-resolver.js # ANTHROPIC_* launch env resolution
│   ├── safety.js                 # Locking, backups, validation
│   ├── profile-validator.js      # Profile validation
│   └── output-helpers.js         # Console output formatting
├── tests/
│   ├── core-library.test.js
│   ├── cli-integration.test.js
│   └── safety.test.js
└── package.json
```

## Planned / Future Features

- Automatic backups during profile switch flow (`csp use`) with backup retention/pruning.

## License

MIT

## Contributing

Contributions welcome! Please ensure tests pass and follow existing code style.

```bash
npm test
```
