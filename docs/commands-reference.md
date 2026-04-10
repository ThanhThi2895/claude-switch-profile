# Commands Reference

Complete reference for all `csp` commands.

## version

Print the installed CSP version.

```bash
csp -v
csp --version
```

**Behavior:**
- `-v` and `--version` print the same semver string
- Prints the version and exits without running any subcommand

---

## select (default)

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

## init

Initialize the profile system and capture current state as "default" profile.

```bash
csp init
```

**Behavior:**
- Creates `~/.claude-profiles/` directory
- Captures current `~/.claude` configuration
- Creates `default` profile and marks it active
- If already initialized, displays current active profile

---

## current

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

## list (ls)

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

## status

Show CSP status dashboard (active profile, profile count, last launch, Claude process state).

```bash
csp status
```

---

## create

Create a new profile from current state or clone existing profile.

```bash
csp create <name> [options]
```

**Options:**
- `--from <profile>` — Clone from existing profile instead of current state
- `-s, --source <path>` — Create from a specific kit directory, then inherit missing managed items from current `~/.claude`
- `-d, --description <text>` — Add description to profile

**Examples:**

```bash
# Create from current state
csp create production

# Create with description
csp create staging -d "Staging environment with logging enabled"

# Clone from existing
csp create backup --from production

# Create from kit directory
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

## save

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

## use

Switch to a different profile.

```bash
csp use [name] [options]
```

**Options:**
- `--dry-run` — Show what would change without executing
- `--no-save` — Skip saving current profile before switching

**Examples:**

```bash
# Switch explicitly
csp use production

# Switch to default implicitly
csp use

# Preview changes first
csp use staging --dry-run

# Switch without saving current state
csp use backup --no-save
```

**Behavior:**
1. Validates target profile exists and profile structure is valid
2. Refuses to switch while Claude Code is running (legacy/global switching mutates `~/.claude` directly)
3. If no name is provided, switches to `default`
4. If the active profile exists and `--no-save` is not set: copies its current snapshot into the active profile directory first
5. Removes managed items/files from `~/.claude`
6. Restores the target profile snapshot into `~/.claude` by copy — including `default` (the source profile snapshot is kept intact)
7. Updates active marker
8. On older installs missing `profiles/default`, CSP only backfills that snapshot when the active profile is `default` or no active profile is set; otherwise it fails closed with repair guidance
9. **Important:** Claude Code session must be restarted for changes to apply

---

## toggle

Launch the previous profile (does not mutate global active profile in isolated mode).

```bash
csp toggle
```

**Behavior:**
- Reads previous profile marker from `~/.claude-profiles/.previous`
- Validates previous profile still exists
- Delegates to `csp launch <previous>`

---

## delete (rm)

Delete a profile.

```bash
csp delete <name> [options]
csp rm <name> [options]
```

**Options:**
- `-f, --force` — Skip confirmation prompt

**Examples:**

```bash
# Delete with confirmation
csp delete experimental
# Delete profile "experimental"? This cannot be undone. (y/N)

# Force delete without prompt
csp delete old-setup --force
```

**Behavior:**
- Cannot delete `default`
- Prompts for confirmation unless `--force` is used
- Permanently removes profile directory and metadata
- If deleting the currently active non-default profile: clears active marker only (does not mutate `~/.claude`)
- Cannot be undone

---

## export

Export a profile as a compressed tar.gz archive.

```bash
csp export <name> [options]
```

**Options:**
- `-o, --output <path>` — Output file path (defaults to `./{name}.csp.tar.gz`)

**Examples:**

```bash
# Export with default filename
csp export production
# Exports to ./production.csp.tar.gz

# Export to custom location
csp export staging -o ~/backups/claude-staging.tar.gz
```

**Behavior:**
- Creates tar.gz archive of the profile snapshot directory
- Includes `source.json` plus copied profile files/directories
- Exporting `default` works like any other profile snapshot
- Protected and session/runtime files remain excluded from the archive

---

## import

Import a profile from tar.gz archive.

```bash
csp import <file> [options]
```

**Options:**
- `-n, --name <name>` — Profile name (defaults to archive filename without extension)
- `-d, --description <text>` — Profile description

**Examples:**

```bash
# Import with default name
csp import production.csp.tar.gz
# Creates profile named "production"

# Import with custom name and description
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

## diff

Compare two profiles to identify differences.

```bash
csp diff <profileA> <profileB>
```

**Special:** Use `current` to compare against active profile.

**Examples:**

```bash
# Compare two profiles
csp diff staging production

# Compare current profile with another
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

---

## deactivate

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
4. Restores the physical `default` snapshot into `~/.claude` by copy
5. Marks `default` as the active legacy profile

---

## launch (la)

Launch an isolated Claude session for a profile. This does **not** change global active profile. All extra arguments are forwarded to `claude`.

```bash
csp launch <name> [claude-args...]
csp la <name> [claude-args...]
```

**Options:**
- `--legacy-global` — Use old behavior (`csp use <name>` then launch)

**Examples:**

```bash
# Launch isolated session
csp launch work

# Launch isolated with Claude flags
csp launch work --dangerously-skip-permissions
csp la dev --model opus

# Launch legacy/global mode
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

Set `CSP_DEBUG_LAUNCH_ENV=1` to print extended launch diagnostics.

---

## exec

Run an arbitrary command inside isolated profile runtime env. This does **not** change global active profile.

```bash
csp exec <name> -- <command> [args...]
```

**Examples:**

```bash
# Run any CLI tool with profile runtime env
csp exec work -- env
csp exec work -- node scripts/check-env.js

# Run a shell function/alias
csp exec hd -- claude-hd2
```

**Behavior:**
1. Validates target profile exists
2. Ensures the profile snapshot exists; for legacy installs missing `default/`, guarded backfill only runs when the active profile is `default` or no active profile is set
3. Prepares per-profile runtime under `~/.claude-profiles/.runtime/<name>`
4. Resolves effective allowlisted `ANTHROPIC_*` launch env with same precedence as `launch`
5. Strips inherited env vars (same sanitization as `launch`)
6. On Unix-like systems, runs the command through your interactive shell so shell functions/aliases can resolve like a normal terminal command; on Windows, keeps direct spawn behavior with `.cmd` / `.bat` wrapper detection
7. Reasserts `CLAUDE_CONFIG_DIR` and allowlisted `ANTHROPIC_*` after shell init so profile isolation wins over shell startup overrides
8. Inherits stdin/stdout/stderr and forwards child exit code
9. Keeps `.active` unchanged and never mutates global `~/.claude`

---

## update

Update the installed `csp` CLI. By default, CSP auto-detects install method from runtime path and runs the matching update flow.

```bash
csp update
csp update --method <npm|brew|standalone>
```

**Options:**
- `-f, --force` — Skip confirmation prompt
- `--method <method>` — Override update method: `npm`, `brew`, or `standalone`

**Examples:**

```bash
# Auto-detect method (recommended)
csp update --force

# Force npm update
csp update --method npm --force
# Runs:
npm install -g claude-switch-profile@latest

# Force Homebrew update
csp update --method brew --force
# Runs:
brew upgrade claude-switch-profile

# Force standalone update
csp update --method standalone
# Uses local install.sh when available, else remote install pipeline
```

**Behavior:**
1. Auto-detects install method when `--method` is omitted (`standalone` > `brew` > `npm` fallback)
2. Validates `--method` only when provided explicitly
3. Shows confirmation unless `--force` is used
4. Executes the matching update flow for detected/selected install method
5. Exits non-zero if the update command fails

---

## uninstall

Uninstall the `csp` CLI while keeping all profiles intact.

```bash
csp uninstall --method <npm|brew|standalone>
csp uninstall --method <npm|brew|standalone> --force
```

**Options:**
- `-f, --force` — Skip confirmation prompt
- `--method <method>` — Install method: `npm`, `brew`, or `standalone`

**Examples:**

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
# Removes ~/.local/bin/csp and ~/.csp-cli directly
```

**Behavior:**
1. Validates uninstall method
2. Shows confirmation (unless `--force`)
3. Never removes `~/.claude-profiles/` (profiles are kept)
4. Does not wipe profile data and does not restore or rewrite `~/.claude`
5. For `standalone`: removes `~/.local/bin/csp` and `~/.csp-cli`
6. For `npm`/`brew`: prints the exact command to run

---

## Troubleshooting

### No active profile

**Error:** `No active profile. Run "csp create <name>" first.`

**Solution:** Initialize with `csp init` to create the default profile.

### Profile doesn't exist

**Error:** `Profile "name" does not exist. Run "csp list" to see available profiles.`

**Solution:** Check available profiles with `csp list` and use exact name.

### Cannot delete default profile

**Error:** `Cannot delete the default profile.`

**Solution:** Only non-default profiles can be deleted.

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

---

## Configuration via Environment Variables

Override default behavior for testing or advanced use:

| Variable | Default | Purpose |
|---|---|---|
| `CSP_HOME` | `process.env.HOME` | Override home directory |
| `CSP_CLAUDE_DIR` | `~/.claude` | Override Claude config directory |
| `CSP_PROFILES_DIR` | `~/.claude-profiles` | Override profiles storage directory |

**Use case:** Testing in isolated environments without affecting your real configuration.

```bash
CSP_HOME=/tmp/test csp list
CSP_CLAUDE_DIR=/tmp/test-claude csp init
CSP_PROFILES_DIR=/tmp/test-profiles csp list
```
