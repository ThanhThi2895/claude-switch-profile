# Claude Switch Profile - System Architecture

## Architecture Overview

Claude Switch Profile is a lightweight Node.js CLI application that manages multiple Claude Code configurations by orchestrating symlinks and file copies. The system follows a modular, layered architecture with clear separation of concerns.

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Layer (bin/)                       │
│                  csp.js - Command Router                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                   Commands Layer (src/commands/)             │
│  init  current  list  create  save  use  delete  export  import  diff
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                  Core Libraries (src/)                      │
├──────────────────────────────────────────────────────────────┤
│  profile-store.js     │  Metadata persistence                │
│  symlink-manager.js   │  Symlink creation/restoration        │
│  file-operations.js   │  File/directory copy/restore         │
│  profile-validator.js │  Structure validation                │
│  safety.js            │  Locks, backups, process detection   │
├──────────────────────────────────────────────────────────────┤
│  constants.js         │  Configuration & paths               │
│  output-helpers.js    │  Console formatting                  │
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
- Register all 9 commands with their options
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
```

---

### 2. Commands Layer (src/commands/)

Each command file exports a single async function matching the command name.

#### init.js
**Flow:**
1. Check if already initialized
2. Create profiles directory if needed
3. Call `createCommand('default')` to capture current state
4. Set 'default' as active

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
3. Otherwise: create new directory and call saveSymlinks + saveFiles
4. Add profile to profiles.json
5. Set as active if first profile

#### save.js
**Flow:**
1. Get active profile
2. Call saveSymlinks to write source.json
3. Call saveFiles to copy mutable files
4. Display success

#### use.js
**Flow (most complex)**
1. Validate target profile exists
2. Validate profile structure
3. (Optional) Validate symlink targets exist
4. If `--dry-run`: show changes and exit
5. If not active: call withLock() to:
   - Save current profile state
   - Create backup
   - Remove managed items from ~/.claude
   - Restore target profile
   - Update .active marker
6. Warn if Claude is running
7. Display success message

#### delete.js
**Flow:**
1. Check profile isn't active
2. Prompt for confirmation (unless --force)
3. Remove profile directory
4. Remove from profiles.json

#### export.js
**Flow:**
1. Validate profile exists
2. tar -czf the entire profile directory
3. Write to output file

#### import.js
**Flow:**
1. Extract tar.gz archive
2. Derive profile name from filename or --name option
3. Add to profiles.json

#### diff.js
**Flow:**
1. Resolve "current" alias to active profile name
2. Validate both profiles exist
3. Compare source.json (symlink targets)
4. Compare file presence and content
5. Display formatted differences

---

### 3. Core Libraries (src/)

#### profile-store.js

**Purpose:** Manage profile metadata and active profile marker

**Data Files:**
- `~/.claude-profiles/profiles.json` — All profile metadata
- `~/.claude-profiles/.active` — Current active profile name

**Functions:**
```javascript
ensureProfilesDir()          // Mkdir ~/.claude-profiles if missing
readProfiles()               // Load profiles.json
writeProfiles(data)          // Save profiles.json
getActive()                  // Read .active file
setActive(name)              // Write .active file
addProfile(name, metadata)   // Add to profiles.json
removeProfile(name)          // Remove from profiles.json
profileExists(name)          // Check if profile dir exists
getProfileDir(name)          // Return profile directory path
listProfileNames()           // Return all profile names
```

**State Management:**
- Reads from disk on each call (no caching)
- Always writes with `JSON.stringify(..., null, 2)` for readability
- Atomic writes (write-replace, not read-modify-write)

---

#### symlink-manager.js

**Purpose:** Manage symlinks in `~/.claude` and save/restore symlink targets

**Data File:**
- `{profile}/source.json` — Map of symlink names to target paths

**Functions:**
```javascript
readCurrentSymlinks()        // Read all managed symlinks from ~/.claude
removeSymlinks()             // Unlink all managed symlinks
createSymlinks(sourceMap)    // Create symlinks from map
saveSymlinks(profileDir)     // Write current symlinks to source.json
restoreSymlinks(profileDir)  // Read source.json and create symlinks
```

**Symlink Items Managed:**
- `CLAUDE.md`, `rules`, `agents`, `skills`, `hooks`, `statusline.cjs`, `.luna.json`

**Key Behaviors:**
- Only manages items in SYMLINK_ITEMS constant
- Resolves to absolute paths (via `resolve()`)
- Skips missing items gracefully
- Overwrites existing symlinks
- Validates existence before creating symlinks

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
- **Copy Files:** settings.json, .env, .ck.json, .ckignore
- **Copy Dirs:** commands, plugins

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
validateSourceTargets(sourceMap)     // Check if symlink targets exist
```

**Validation Rules:**
- Profile directory must exist
- source.json must be present (or can be missing if no symlinks)
- All files mentioned must be valid (readable, not corrupted)
- Symlink targets should exist (unless --force used)

---

#### safety.js

**Purpose:** Provide operational safety features

**Data:**
- `~/.claude-profiles/.lock` — PID-based lock file
- `~/.claude-profiles/.backup/{timestamp}/` — Timestamped backups

**Functions:**
```javascript
acquireLock()                // Write lock file with PID
releaseLock()                // Delete lock file
withLock(fn)                 // Acquire/release around async function
isProcessRunning(pid)        // Check if PID is still running
isClaudeRunning()            // Detect Claude process via pgrep
warnIfClaudeRunning()        // Print warning if Claude found
createBackup()               // Create timestamped backup of managed items
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
  - Kept indefinitely (user responsibility for cleanup)

- **Process Detection:**
  - Uses `pgrep -f "claude"` to find Claude process
  - Gracefully handles systems without pgrep
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
SOURCE_FILE             // "source.json" symlink targets
LOCK_FILE               // ".lock" operational lock
BACKUP_DIR              // ".backup" timestamped backups

SYMLINK_ITEMS           // Items managed via symlinks
COPY_ITEMS              // Files managed via copy
COPY_DIRS               // Directories managed via copy
NEVER_TOUCH             // Items never managed
ALL_MANAGED             // Union of above
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
           saveSymlinks() → Write source.json
           saveFiles()    → Copy COPY_ITEMS + COPY_DIRS
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
Is profile already active?
    ├─ YES: info("Already active") → Exit
    └─ NO: Continue
    ↓
validateProfile() → Error if invalid
    ↓
validateSourceTargets() → Warning if targets missing
    ├─ --force specified?
    │  ├─ YES: Proceed
    │  └─ NO: error("Use --force") → Exit
    │
    └─ All valid: Continue
    ↓
--dry-run specified?
    ├─ YES: info("[Dry run] Would switch...") → Exit
    └─ NO: Continue
    ↓
warnIfClaudeRunning()
    ↓
withLock(async () => {
    │
    ├─ Active profile exists && !--no-save?
    │  ├─ YES: saveSymlinks(active_dir)
    │  │        saveFiles(active_dir)
    │  │        info("Saved current state")
    │  └─ NO: Skip
    │
    ├─ createBackup()
    │  └─ Copy all managed items to ~/.claude-profiles/.backup/{timestamp}
    │
    ├─ removeSymlinks()
    │  └─ Unlink all SYMLINK_ITEMS from ~/.claude
    │
    ├─ removeFiles()
    │  └─ Delete all COPY_ITEMS + COPY_DIRS from ~/.claude
    │
    ├─ restoreSymlinks(target_dir)
    │  └─ Read source.json and create symlinks
    │
    ├─ restoreFiles(target_dir)
    │  └─ Copy files/dirs from profile to ~/.claude
    │
    ├─ setActive(profile_name)
    │  └─ Write .active file
    │
    └─ success("Switched to profile")

})
    ↓
info("Restart your Claude Code session")
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
pgrep -f "claude"
  ↓
Returns PIDs if found
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
- Symlink targets missing (unless --force)

**Behavior:** Print error and exit(1)

### Operational Errors (during execution)
- Lock file can't be acquired
- File copy fails
- Symlink creation fails
- JSON parsing fails

**Behavior:** Print error and release lock, exit(1)

### Warnings (non-fatal)
- Claude process detected running
- Symlink targets missing (with --force)
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

To add a new symlink item:
1. Add to `SYMLINK_ITEMS` in constants.js
2. Ensure external target directory exists
3. Run `csp save` to capture symlink in current profile
4. Symlinks will be managed automatically in future switches

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
   - Symlink operations
   - File operations
   - Validation logic

2. **CLI Integration Tests** (cli-integration.test.js)
   - End-to-end command flows
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
| Switch profile | < 1s | Lock + backup + copy operations |
| Export profile | < 2s | tar compression time |
| Import profile | < 2s | tar extraction time |
| Diff profiles | < 100ms | File listing + comparison |

**Bottleneck:** File copying (scales with ~/.claude size)

---

## Deployment & Distribution

### Distribution Method
- npm registry (`npm install -g claude-switch-profile`)
- Single executable (via pkg/nexe) for standalone use

### Installation Footprint
- ~2 MB (node_modules)
- ~100 KB (application code)
- ~500 MB (optional: bundled Node.js)

---

## Security Boundaries

### Trust Model
- Single-user model (per-machine user)
- Filesystem permissions (standard Unix model)
- No network access
- No authentication required

### Trusted Items
- Symlink targets (external repos)
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

**Last Updated:** 2026-03-11
**Version:** 1.0.0
