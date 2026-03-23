# Claude Switch Profile (CSP)

[![npm version](https://img.shields.io/npm/v/claude-switch-profile)](https://www.npmjs.com/package/claude-switch-profile)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A CLI tool for managing multiple Claude Code configurations and profiles. Effortlessly switch between different development setups, each with their own rules, agents, skills, and settings.

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
- Unix/Linux/macOS (uses symlinks and POSIX tools)
- Windows 10+ (uses junctions — no admin required)

## Quick Start

### 1. Initialize

Capture your current Claude Code setup as the default profile:

```bash
csp init
```

This creates `~/.claude-profiles/default/` containing your current configuration.

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

### 6. Uninstall CSP

Remove CSP and restore your Claude Code to its original state:

```bash
csp uninstall
# Uninstall CSP and remove all profiles? This cannot be undone. (y/N)
```

## Commands Reference

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

Display the currently active profile.

```bash
csp current
```

**Output:**
```
✓ Active profile: default
ℹ Location: /home/user/.claude-profiles/default
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
 * profile-name — optional description (YYYY-MM-DD)
   other-profile (YYYY-MM-DD)
```

The `*` marks the currently active profile.

---

### create

Create a new profile from current state or clone existing profile.

```bash
csp create <name> [options]
```

**Options:**
- `--from <profile>` — Clone from existing profile instead of current state
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

**Behavior:**
- Creates profile directory: `~/.claude-profiles/<name>/`
- If `--from` is specified, clones all content from source profile
- Otherwise, captures current `~/.claude` state
- If this is the first profile, automatically sets it as active
- Saves metadata (created timestamp, description)

---

### save

Save the current `~/.claude` state to the active profile.

```bash
csp save
```

**Behavior:**
- Captures all managed symlinks and files from `~/.claude`
- Overwrites profile's `source.json` and file copies
- Useful after modifying rules, settings, or other configuration
- Requires active profile (run `csp create` if none exists)

---

### use

Switch to a different profile.

```bash
csp use <name> [options]
```

**Options:**
- `--dry-run` — Show what would change without executing
- `--no-save` — Skip saving current profile before switching
- `--force` — Switch even if some symlink targets are missing

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

Force switch with missing targets:
```bash
csp use legacy --force
```

**Behavior:**
1. Validates target profile exists and is valid
2. (Optional) Validates symlink targets exist
3. If active profile exists and `--no-save` is not set: saves current state
4. Creates automatic backup at `~/.claude-profiles/.backup/`
5. Removes all managed items from `~/.claude`
6. Restores target profile's symlinks and files
7. Updates active marker
8. **Important:** Claude Code session must be restarted for changes to apply

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
- Cannot delete the active profile (must switch first)
- Prompts for confirmation unless `--force` is used
- Permanently removes profile directory and metadata
- Cannot be undone (but auto-backups from `use` are preserved)

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
- Creates tar.gz archive of entire profile directory
- Includes source.json (symlink targets) and all copied files
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

Symlink targets (source.json): identical

File differences:
  settings.json — different
  .env — only in production
  rules/CLAUDE.md — different
```

**Behavior:**
- Compares `source.json` (symlink targets)
- Lists file presence and content differences
- Shows which files differ and in which profile they exist

---

### launch (la)

Switch to a profile and immediately launch Claude Code. All extra arguments are forwarded to `claude`.

```bash
csp launch <name> [claude-args...]
csp la <name> [claude-args...]
```

**Examples:**

Switch and launch Claude:
```bash
csp launch work
```

Launch with flags:
```bash
csp launch work --dangerously-skip-permissions
csp la dev --model opus
```

**Behavior:**
1. Calls `csp use <name>` internally (saves current profile, switches)
2. Spawns `claude` process with all extra arguments
3. Inherits stdin/stdout/stderr for interactive use
4. Forwards Claude's exit code

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
2. Restores the active profile (or `--profile` choice) to `~/.claude`
3. Removes `~/.claude-profiles/` entirely
4. Prints reminder to run `npm uninstall -g claude-switch-profile`

---

## How Profiles Work

### Profile Storage

Profiles are stored in `~/.claude-profiles/`:

```
~/.claude-profiles/
├── .active                    # Current active profile name
├── profiles.json              # Metadata for all profiles
├── default/
│   ├── source.json           # Symlink targets
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

**Symlinked Items** (via `source.json`):
- `CLAUDE.md` — Project-specific Claude configuration
- `rules/` — Development rules and guidelines
- `agents/` — Agent scripts and configurations
- `skills/` — Custom Luna skills
- `hooks/` — Pre/post action hooks
- `statusline.cjs` — Custom statusline
- `.luna.json` — Luna configuration

**Copied Files**:
- `settings.json` — Editor settings
- `.env` — Environment variables
- `.ck.json` — Custom settings
- `.ckignore` — Ignore patterns

**Copied Directories**:
- `commands/` — Custom commands
- `plugins/` — Custom plugins

**Never Touched** (runtime/session data):
- `.credentials.json`
- `projects/`
- `backups/`
- `cache/`, `debug/`, `telemetry/`
- `history.jsonl`
- `plans/`, `todos/`, `tasks/`
- `agent-memory/`, `session-env/`
- All other session-specific data

### Symlink vs. Copy Strategy

**Why symlinks for some items?**
- Rules, agents, skills often live in external git repos
- Multiple profiles may share the same rules/skills
- Symlinks avoid duplication and keep everything in sync

**Why copies for others?**
- Settings and env vars are environment-specific
- Each profile needs its own independent configuration
- Prevents accidental modifications from affecting other profiles

### Real Directory Handling

When `csp save` (or `csp use`) encounters a **real directory/file** in `~/.claude` for a managed item (instead of a symlink), it automatically:

1. **Moves** the real item into the profile directory (`~/.claude-profiles/<name>/<item>`)
2. **Replaces** it with a symlink at the original location
3. **Records** the new location in `source.json`

This ensures that profiles created from a fresh `~/.claude` setup (before any symlinks exist) work correctly on first use.

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

### Automatic Backups

Every profile switch creates a timestamped backup:

```
~/.claude-profiles/.backup/
├── 2026-03-11T14-30-45-123Z/
│   ├── source.json
│   ├── settings.json
│   ├── .env
│   └── ...
└── 2026-03-11T15-45-22-456Z/
    └── ...
```

Backups are kept indefinitely. You can manually restore by copying from backup directory.

### Claude Process Detection

When switching profiles, CSP detects if Claude Code is running:

```
⚠ Claude Code appears to be running. Restart your Claude session after switching profiles.
```

**Important:** Changes only take effect after restarting Claude Code.

### Windows Support

On Windows, CSP uses NTFS **junctions** instead of symlinks. Junctions:
- Do not require Administrator or Developer Mode
- Work transparently for all directory-type items (rules, agents, skills, hooks)
- Work for file-type items (CLAUDE.md, statusline.cjs, .luna.json) as well

Process detection uses `tasklist` instead of `pgrep` on Windows.

Export/import commands use the built-in `tar.exe` available on Windows 10+.

### Validation

Before switching, CSP validates:
1. Target profile exists
2. Profile structure is valid
3. (Optional with `--force`) Symlink targets are accessible

Use `--force` to proceed even if validation fails:

```bash
csp use legacy --force
```

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
csp create experimental --from current -d "Testing new Luna skills"

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

### Cannot delete active profile

**Error:** `Cannot delete active profile "default". Switch to another profile first.`

**Solution:** Switch to a different profile before deleting.

```bash
csp use production
csp delete default
```

### Stale lock file

**Error:** `Another csp operation is running (PID: 12345). Remove ~/.claude-profiles/.lock if stale.`

**Solution:** If the process is not running, manually remove the lock:

```bash
rm ~/.claude-profiles/.lock
```

### Symlink targets missing

**Warning:** `Some symlink targets are missing: rules/development-rules.md — missing target`

**Solution:** Either restore the missing files to their original location or use `--force`:

```bash
csp use production --force
```

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
│   │   ├── create.js
│   │   ├── save.js
│   │   ├── use.js
│   │   ├── delete.js
│   │   ├── export.js
│   │   ├── import.js
│   │   ├── diff.js
│   │   ├── launch.js
│   │   └── uninstall.js
│   ├── constants.js              # Configuration constants
│   ├── platform.js               # Cross-platform compatibility
│   ├── profile-store.js          # Profile metadata management
│   ├── symlink-manager.js        # Symlink operations
│   ├── file-operations.js        # File copy/restore operations
│   ├── safety.js                 # Locking, backups, validation
│   ├── profile-validator.js      # Profile validation
│   └── output-helpers.js         # Console output formatting
├── tests/
│   ├── core-library.test.js
│   ├── cli-integration.test.js
│   └── safety.test.js
└── package.json
```

## License

MIT

## Contributing

Contributions welcome! Please ensure tests pass and follow existing code style.

```bash
npm test
```
