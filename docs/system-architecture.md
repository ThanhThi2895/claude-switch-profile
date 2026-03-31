# Claude Switch Profile - System Architecture

## Architecture Overview

Claude Switch Profile is a lightweight Node.js CLI application that manages multiple Claude Code configurations with two modes: legacy global switching (`use`) and isolated launch sessions (`launch`) via per-profile runtime roots. The `default` profile is now a physical snapshot created by `csp init`, while older installs missing `profiles/default` only backfill it when the live `~/.claude` state is safe to trust. Protected and session files remain excluded throughout. The system follows a modular, layered architecture with clear separation of concerns. It also provides convenience commands: `select` (interactive picker, default), `status` (dashboard), and `toggle` (quick previous-profile switch).

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Layer (bin/)                       │
│                  csp.js - Command Router                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                   Commands Layer (src/commands/)             │
│  init  current  list  create  save  use  delete  export  import  diff  deactivate  launch  uninstall  select  status  toggle
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                  Core Libraries (src/)                      │
├──────────────────────────────────────────────────────────────┤
│  profile-store.js     │  Metadata + schema normalization       │
│  runtime-instance-manager.js │ Isolated runtime prep/sync      │
│  item-manager.js      │  Managed item copy/move                │
│  file-operations.js   │  File/directory copy/restore           │
│  launch-effective-env-resolver.js │ ANTHROPIC_* env resolution  │
│  profile-validator.js │  Structure validation                  │
│  safety.js            │  Global/runtime locks, backups       │
├──────────────────────────────────────────────────────────────┤
│  constants.js         │  Configuration & paths               │
│  output-helpers.js    │  Console formatting                  │
│  platform.js          │  Cross-platform compatibility        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│              Filesystem Layer                               │
├──────────────────────────────────────────────────────────────┤
│  ~/.claude/           │  Active Claude configuration         │
│  ~/.claude-profiles/  │  All profile storage                 │
└──────────────────────────────────────────────────────────────┘
```

## Module Architecture

### 1. CLI Entry Point (bin/csp.js)

**Purpose:** Parse arguments and route to command handlers

**Responsibilities:**
- Load package.json for version
- Create Commander.js program
- Register all 16 commands with their options
- Parse command line arguments
- Invoke appropriate command handler

**Dependencies:** commander, chalk, all commands

**Key Functions:**
```javascript
program.command('init')         // Initialize
program.command('current')      // Show active
program.command('list')         // List profiles
program.command('create')       // Create new profile
program.command('save')         // Save current state
program.command('use')          // Switch profile
program.command('delete')       // Delete profile
program.command('export')       // Export to archive
program.command('import')       // Import from archive
program.command('diff')         // Compare profiles
program.command('deactivate')   // Deactivate active profile
program.command('launch')       // Isolated launch (default) or legacy-global
program.command('uninstall')    // Remove CSP completely
program.command('select')       // Interactive profile picker (default command)
program.command('status')       // CSP status dashboard
program.command('toggle')       // Switch to previous profile
```

---

### 2. Commands Layer (src/commands/)

Each command file exports a single async function matching the command name.

#### init.js
**Flow:**
1. Check if already initialized
2. Create profiles directory if needed
3. Ensure `default` metadata exists in `profiles.json`
4. Materialize `~/.claude-profiles/default/` from the current managed contents of `~/.claude`
5. Set `default` as active on first init

#### current.js
**Flow:**
1. Read active profile from `.active`
2. Display name and location
3. Warn if no active profile

#### list.js
**Flow:**
1. Read profiles.json metadata
2. Format as table with descriptions and dates
3. Mark active profile with `*`

#### create.js
**Flow:**
1. Validate profile doesn't already exist
2. If `--from` option: clone from source profile
3. Otherwise: create new directory and capture managed items/files
4. Add profile to profiles.json
5. Set as active if first profile

#### save.js
**Flow:**
1. Get active profile
2. If active is `default`, ensure the physical default snapshot exists
3. Call saveItems to write source.json
4. Call saveFiles to copy mutable files/directories
5. Display success

#### use.js
**Flow (most complex)**
1. Validate target profile exists
2. If target or active profile is `default`, ensure its physical snapshot exists
3. Validate profile structure
4. If `--dry-run`: show changes and exit
5. If not active: call withLock() to:
   - Save current active profile snapshot
   - Remove managed items/files from `~/.claude`
   - Restore target profile snapshot, including `default`
   - Update `.active` marker
6. On older installs missing `profiles/default`, only backfill when active is `default` or no active profile is set; otherwise fail closed
7. Warn if Claude is running
8. Display success message

#### delete.js
**Flow:**
1. Check profile isn't active
2. Prompt for confirmation (unless --force)
3. Remove profile directory
4. Remove from profiles.json

#### export.js
**Flow:**
1. Validate profile exists
2. If exporting active profile, refresh its snapshot first
3. If exporting `default`, ensure the physical default snapshot exists
4. tar -czf the entire profile directory
5. Write to output file

#### import.js
**Flow:**
1. Extract tar.gz archive
2. Derive profile name from filename or --name option
3. Add to profiles.json

#### diff.js
**Flow:**
1. Resolve "current" alias to active profile name
2. Validate both profiles exist
3. Compare source.json (managed item map)
4. Compare file presence and content
5. Display formatted differences

#### deactivate.js
**Flow:**
1. Read active profile
2. Exit early if no active profile or active is `default`
3. Delegate to `useCommand(DEFAULT_PROFILE, options)`
4. Optionally save current non-default state (unless `--no-save`)
5. Restore the physical `default` snapshot into `~/.claude`
6. Mark `default` as the active legacy profile and print restart guidance

#### launch.js
**Flow:**
1. Validate profile exists
2. If launching `default`, ensure its physical snapshot exists
3. Default mode: acquire per-profile runtime lock, sync runtime root, resolve effective allowlisted `ANTHROPIC_*` launch env (`settings.json env` > `.env` allowlist > parent env), sanitize inherited launch env (`CLAUDECODE`/`CLAUDE_CONFIG_DIR`), inherited `ANTHROPIC_*`, and Claude session env vars, then set `CLAUDE_CONFIG_DIR` to runtime root (Claude Code auto-discovers config from this path)
4. Optional `--legacy-global`: call `useCommand()` first
5. Resolve Claude executable path, then spawn process with forwarded arguments (`where.exe` + Windows fallbacks when needed)
6. Inherit stdio for interactive use
7. Forward Claude's exit code
8. Preserve `default` metadata mode as `legacy` even when launched through isolated runtime sync

#### uninstall.js
**Flow:**
1. Check if profiles directory exists
2. Show summary of what will happen
3. Prompt for confirmation (unless `--force`)
4. Warn if Claude is running
5. Acquire lock and create final backup (best effort)
6. Remove all managed items from `~/.claude`
7. Restore chosen profile (active or `--profile`), including `default` when selected
8. Release lock, delete `~/.claude-profiles/` entirely
9. Print npm uninstall reminder

#### select.js (default command)
**Flow:**
1. Check if initialized; fallback to list for non-TTY
2. Render interactive arrow-key menu with profile list
3. Highlight active profile in green, selected cursor in cyan
4. On Enter: delegate to `launchCommand()` for chosen profile
5. On Esc/Ctrl+C: cancel and exit

#### status.js
**Flow:**
1. Check if initialized
2. Read profiles metadata and active profile
3. Check if Claude is running
4. Display dashboard: active profile, profile count, last launch timestamp, Claude state

#### toggle.js
**Flow:**
1. Read previous profile from `.previous` marker
2. Validate previous profile exists and differs from active
3. Delegate to `launchCommand(previous)` to switch and launch

---

### 3. Core Libraries (src/)

#### profile-store.js

**Purpose:** Manage profile metadata, schema normalization, runtime metadata, and active legacy marker

**Data Files:**
- `~/.claude-profiles/profiles.json` — Versioned profile metadata
- `~/.claude-profiles/.active` — Current active profile name for legacy `use`
- `~/.claude-profiles/default/` — Physical default snapshot created by `init` or guarded backfill

**Functions:**
```javascript
ensureProfilesDir()             // Mkdir ~/.claude-profiles if missing
readProfiles()                  // Load + normalize profiles.json (legacy/v2)
writeProfiles(data)             // Save profiles.json in v2 schema
getActive()                     // Read .active file
setActive(name)                 // Write .active file
addProfile(name, metadata)      // Add profile metadata
removeProfile(name)             // Remove profile metadata
ensureDefaultProfileSnapshot()  // Materialize guarded default snapshot when safe
profileExists(name)             // Check if profile dir exists
getProfileDir(name)             // Return profile directory path
getRuntimeDir(name)             // Return isolated runtime path
getProfileMeta(name)            // Return metadata for one profile
updateProfileMeta(name, patch)  // Patch metadata atomically
markRuntimeInitialized(name)    // Stamp runtime init + launch timestamps
markProfileLaunched(name)       // Stamp launch timestamp
listProfileNames()              // Return all profile names
```

**State Management:**
- Reads from disk on each call (no caching)
- Always writes with `JSON.stringify(..., null, 2)` for readability
- Atomic writes (write-replace, not read-modify-write)

---

#### runtime-instance-manager.js

**Purpose:** Build and sync isolated runtime roots for launch-time account sessions

**Data Paths:**
- `~/.claude-profiles/.runtime/<profile>/` — Per-profile isolated runtime root

**Functions:**
```javascript
ensureRuntimeInstance(profileName) // Prepare runtime root and return path
seedRuntimeIfNeeded(profileName)   // Initialize/sync runtime + update metadata
syncStaticConfig(profileName)      // Sync managed static config into runtime
```

**Key Behaviors:**
- Syncs static profile config (managed items + copied files/dirs)
- Preserves managed-item symlinks during runtime sync by copying with symlink-aware filesystem operations instead of flattening links into plain directories/files
- Keeps runtime/account continuity isolated per profile runtime root
- Rewrites settings paths for runtime root when needed
- Supports repeated launch reuse with refresh-on-launch policy

---

#### item-manager.js

**Purpose:** Manage static managed items (`MANAGED_ITEMS`) across profile save/restore/switch flows

**Functions:**
```javascript
readCurrentItems()     // Build map of managed items in ~/.claude
copyItems(profileDir)  // Copy managed items from ~/.claude to profileDir + source.json
saveItems(profileDir)  // Alias of copyItems
restoreItems(profileDir) // Restore managed items from source map into ~/.claude
removeItems()          // Remove managed items from ~/.claude
moveItemsToProfile(profileDir) // Move managed items ~/.claude -> profile
moveItemsToClaude(profileDir)  // Move managed items profile -> ~/.claude
```

---

#### file-operations.js

**Purpose:** Manage file and directory copies (mutable configuration)

**Data:**
- `{profile}/{file}` — Copied files (settings.json, .env, etc.)
- `{profile}/{dir}/` — Copied directories (commands, plugins)

**Functions:**
```javascript
saveFiles(profileDir)        // Copy COPY_ITEMS + COPY_DIRS to profile
restoreFiles(profileDir)     // Copy from profile to ~/.claude
removeFiles()                // Delete managed files/dirs from ~/.claude
```

**Managed Items:**
- **Copy Files:** settings.json, .env, .ck.json, .ckignore, .mcp.json, .mcp.json.example, .env.example, .gitignore
- **Copy Dirs:** commands, plugins, workflows, scripts, output-styles, schemas

**Key Behaviors:**
- Creates profileDir if missing
- Removes destination before copying (avoid merge issues)
- Skips missing source files
- Recursively copies directories with `cpSync(..., { recursive: true })`

---

#### profile-validator.js

**Purpose:** Validate profile structure before applying

**Functions:**
```javascript
validateProfile(profileDir)          // Check if profile dir is valid
validateSourceTargets(sourceMap)     // Check if managed item targets exist
```

**Validation Rules:**
- Profile directory must exist
- source.json must be present
- All files mentioned must be valid (readable, not corrupted)
- Managed item targets should exist (unless --force used)

---

#### safety.js

**Purpose:** Provide operational safety features

**Data:**
- `~/.claude-profiles/.lock` — PID-based global operation lock
- `~/.claude-profiles/.runtime.<profile>.lock` — PID-based per-profile runtime init lock
- `~/.claude-profiles/.backup/{timestamp}/` — Timestamped backups

**Functions:**
```javascript
acquireLock()                     // Write global lock file with PID
releaseLock()                     // Delete global lock file
withLock(fn)                      // Acquire/release global lock around async fn
acquireRuntimeLock(profileName)   // Write runtime lock file with PID
releaseRuntimeLock(profileName)   // Delete runtime lock file
withRuntimeLock(profileName, fn)  // Acquire/release runtime lock around async fn
isClaudeRunning()                 // Detect Claude process via platform layer
warnIfClaudeRunning()             // Print warning if Claude found
createBackup()                    // Create timestamped backup of managed items
```

**Key Features:**
- **Lock Mechanism:**
  - Writes process.pid to .lock
  - Detects stale locks (process no longer running)
  - Throws error if lock exists and process is alive

- **Backup Creation:**
  - Timestamp format: ISO string with colons replaced by hyphens
  - Saves source.json + all COPY_ITEMS + all COPY_DIRS
  - Called before destructive operations
  - Pruned to MAX_BACKUPS (2) most recent

- **Process Detection:**
  - Uses `findProcess('claude')` from platform.js (cross-platform)
  - Windows: `tasklist` command
  - Unix: `pgrep` command
  - Gracefully handles systems without these tools
  - Warns user to restart Claude after switching

---

#### constants.js

**Purpose:** Centralized configuration and constants

**Key Constants:**
```javascript
CLAUDE_DIR              // ~/.claude (or CSP_CLAUDE_DIR override)
PROFILES_DIR            // ~/.claude-profiles (or CSP_PROFILES_DIR override)

ACTIVE_FILE             // ".active" marker
PROFILES_META           // "profiles.json" metadata
SOURCE_FILE             // "source.json" managed item map
LOCK_FILE               // ".lock" operational lock
BACKUP_DIR              // ".backup" timestamped backups

MANAGED_ITEMS           // Managed static items copied into profiles/runtime
MANAGED_DIRS            // Directory-type managed items
COPY_ITEMS              // Mutable files managed via copy
COPY_DIRS               // Directories managed via copy
NEVER_CLONE             // Runtime/session items never managed
NEVER_TOUCH             // Alias of NEVER_CLONE
RUNTIME_DIR_NAME        // Runtime root directory name (.runtime)
RUNTIMES_DIR            // Runtime base directory
LAUNCH_CONFIG_ENV       // Env var used by launch (CLAUDE_CONFIG_DIR)
LAUNCH_ANTHROPIC_ENV_KEYS // Allowlisted ANTHROPIC_* keys for launch
ALL_MANAGED             // Union of managed + copied items
```

**Environment Overrides:**
- `CSP_HOME` → Override home directory
- `CSP_CLAUDE_DIR` → Override ~/.claude path
- `CSP_PROFILES_DIR` → Override ~/.claude-profiles path

---

#### output-helpers.js

**Purpose:** Consistent console output formatting

**Functions:**
```javascript
success(msg)     // Green ✓ prefix
warn(msg)        // Yellow ⚠ prefix
error(msg)       // Red ✗ prefix to stderr
info(msg)        // Blue ℹ prefix
table(rows)      // Formatted table output
```

**Formatting:**
- Uses chalk for colors
- Unicode symbols (✓, ⚠, ✗, ℹ) for visual distinction
- Dim text for secondary information
- Bold text for important information

---

#### platform.js

**Purpose:** Cross-platform compatibility layer for Windows and Unix

**Functions:**
```javascript
isWindows                      // Boolean: process.platform === 'win32'
findProcess(name)              // Cross-platform process detection
```

**Key Behaviors:**
- On Windows: uses `tasklist /FI` for process detection
- On Unix: uses `pgrep -x` for process detection
- Gracefully handles missing tools (returns false on error)

---

## Data Flow Diagrams

### Profile Creation Flow

```
csp create <name> [--from <source>]
    ↓
Check if profile exists → Error if yes
    ↓
Is --from specified?
    ├─ YES: cpSync(source_dir, profile_dir, recursive)
    │       └─ info("Cloned from...")
    │
    └─ NO: Create profile_dir
           copy managed/copy items from ~/.claude
           write source.json
           saveFiles() → Copy COPY_ITEMS + COPY_DIRS
           └─ info("Captured current configuration")
    ↓
addProfile(name, metadata)
    ↓
Is active profile empty?
    ├─ YES: setActive(name)
    └─ NO: (leave active unchanged)
    ↓
success("Profile created at {path}")
```

### Profile Switching Flow (use command)

```
csp use <profile> [--dry-run] [--no-save] [--force]
    ↓
Validate profile exists → Error if no
    ↓
If target or active is default: ensure default snapshot exists
    ↓
Legacy install missing profiles/default?
    ├─ active = default or no active → backfill from current managed ~/.claude
    └─ active = non-default         → fail closed with repair guidance
    ↓
Is profile already active?
    ├─ YES: info("Already active") → Exit
    └─ NO: Continue
    ↓
validateProfile() → Error if invalid
    ↓
--dry-run specified?
    ├─ YES: info("[Dry run] Would switch...") → Exit
    └─ NO: Continue
    ↓
assertClaudeNotRunning()
    ↓
withLock(async () => {
    │
    ├─ Active profile exists && !--no-save?
    │  ├─ YES: save active snapshot into active profile dir
    │  └─ NO: Skip
    │
    ├─ remove managed items/files from ~/.claude
    │
    ├─ restore target snapshot into ~/.claude
    │
    ├─ setActive(profile_name)
    │
    └─ success("Switched to profile")
})
    ↓
info("Restart your Claude Code session")
```

### Isolated Launch Flow (launch command)

```
csp launch <profile> [claude-args...]
    ↓
Validate profile exists
    ↓
--legacy-global?
    ├─ YES: call use flow above, then spawn claude
    └─ NO: isolated mode
          ↓
       withRuntimeLock(profile, async () => {
          ensureRuntimeInstance(profile)
          // sync static config into ~/.claude-profiles/.runtime/<profile>
       })
          ↓
       spawn claude with env:
       CLAUDE_CONFIG_DIR=~/.claude-profiles/.runtime/<profile>
          ↓
       keep .active unchanged
```

### Profile Diff Flow

```
csp diff <profileA> <profileB>
    ↓
Resolve "current" to active profile name
    ↓
Validate both profiles exist
    ↓
Compare source.json
    ├─ Read source.json from both profiles
    ├─ Diff all keys
    └─ Display differences or "identical"
    ↓
Compare files
    ├─ List files in profileA
    ├─ List files in profileB
    ├─ Find only-in-A, only-in-B, different
    └─ Display formatted differences
    ↓
Done
```

## State Transitions

### Profile Active State

```
           (no profiles)
                ↓
         csp init
                ↓
    .active = "default"
       Profiles: {default}
                ↓
         csp create work
                ↓
   .active = "default"
   Profiles: {default, work}
                ↓
         csp use work
                ↓
      .active = "work"
   Profiles: {default, work}
                ↓
       csp delete default
           (forbidden if active)
                ↓
      (state unchanged)
```

## Concurrency & Locking

### Lock File Mechanism

```
User: csp use staging
    ↓
acquireLock()
    │
    ├─ Check ~/.claude-profiles/.lock exists?
    │  │
    │  ├─ NO: Write PID → Success
    │  │
    │  └─ YES: Read PID
    │      │
    │      ├─ Process still running?
    │      │  ├─ YES: Throw error (concurrent operation)
    │      │  └─ NO: Delete stale lock, write new PID
    │      │
    │      └─ Continue
    ↓
... do work ...
    ↓
releaseLock() (in finally block)
    │
    └─ Delete ~/.claude-profiles/.lock
```

**Key Safety Properties:**
1. Only one CSP operation can run at a time
2. Stale locks are automatically cleaned
3. Lock is released even if operation fails (try/finally)
4. PIDs identify which process owns the lock

---

## External Integrations

### Environment Detection

**Claude Process Detection:**
```
Platform detection via platform.js:
  - Unix: pgrep -x "claude"
  - Windows: tasklist /FI "IMAGENAME eq claude.exe" /NH
    ↓
  Returns true/false
    ↓
  Print warning to user
    ↓
  User must manually restart Claude Code
```

### Archive Operations (export/import)

**Export:**
```
tar -czf <output> -C <profileDir> .
  ↓
Creates tar.gz of entire profile directory
```

**Import:**
```
tar -xzf <input> -C <destDir>
  ↓
Extracts to new profile directory
```

---

## Error Handling Strategy

### Validation Errors (before execution)
- Profile doesn't exist
- Profile structure invalid
- Invalid profile name/path

**Behavior:** Print error and exit(1)

### Operational Errors (during execution)
- Global/runtime lock file can't be acquired
- File copy/sync fails
- Claude process spawn fails
- JSON parsing fails

**Behavior:** Print error and release lock, exit(1)

### Warnings (non-fatal)
- Claude process detected running
- Profile recently used in isolated launch mode but user runs legacy `use`
- Already at target profile

**Behavior:** Print warning and continue

---

## Configuration & Extensibility

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `CSP_HOME` | `process.env.HOME` | Override home directory |
| `CSP_CLAUDE_DIR` | `~/.claude` | Override Claude config dir |
| `CSP_PROFILES_DIR` | `~/.claude-profiles` | Override profile storage |

**Use Case:** Isolated testing without affecting real configuration

### Adding New Managed Items

To add a new managed static item:
1. Add to `MANAGED_ITEMS` in constants.js
2. Ensure item exists in profile source directory
3. Run `csp save` if needed to capture into profile
4. Item will sync into isolated runtime on launch

To add a new copied file:
1. Add to `COPY_ITEMS` in constants.js
2. Existing profiles don't have the file? Create it manually
3. Run `csp save` to copy in current profile
4. All future profile switches will manage it

To add protected items (never managed):
1. Add to `NEVER_TOUCH` in constants.js
2. These items remain untouched during switches

---

## Testing Architecture

### Test Categories

1. **Core Library Tests** (core-library.test.js)
   - Profile store operations
   - File operations
   - Validation logic

2. **CLI Integration Tests** (cli-integration.test.js)
   - End-to-end command flows
   - Isolated launch + legacy-global launch behavior
   - Runtime metadata + runtime root sync
   - Command option parsing
   - Error scenarios

3. **Safety Tests** (safety.test.js)
   - Lock file behavior
   - Backup creation
   - Concurrent operation prevention
   - Process detection

### Test Strategy

- Use temporary directories for isolation
- Override environment variables (CSP_PROFILES_DIR, etc.)
- Mock external calls (pgrep)
- Assert file system state changes

---

## Performance Characteristics

| Operation | Time | Notes |
|---|---|---|
| List profiles | < 100ms | Just reads JSON files |
| Create profile | < 500ms | Depends on file count/size |
| Save state | < 500ms | Copy time scales with file count |
| Switch profile | < 1s | Legacy global lock + copy operations |
| Launch profile | < 1s | Runtime lock + runtime sync + spawn |
| Export profile | < 2s | tar compression time |
| Import profile | < 2s | tar extraction time |
| Diff profiles | < 100ms | File listing + comparison |

**Bottleneck:** File copying (scales with ~/.claude size)

---

## Deployment & Distribution

### Distribution Method
- npm registry (`npm install -g claude-switch-profile`)

### Installation Footprint
- Depends on global npm + Node.js environment; no bundled standalone binary is documented in this repository

---

## Security Boundaries

### Trust Model
- Single-user model (per-machine user)
- Filesystem permissions (standard Unix model)
- No network access
- No authentication required

### Trusted Items
- Profile-managed config files/directories
- File contents (user responsibility)
- Lock files (integrity verified via PID)

### Untrusted Items
- User-provided profile names
- Archive contents (validated on extract)
- External configuration data

---

## Future Architecture Changes

### Potential Enhancements
1. **Merge profiles** — Combine configurations from multiple profiles
2. **Profile versioning** — Keep history of profile states
3. **Hooks system** — Custom scripts on profile switches
4. **Web UI** — Browser-based profile manager
5. **Cloud sync** — Multi-machine profile synchronization

---

**Last Updated:** 2026-03-31
**Version:** 1.4.0
