# Phase 3: CLI Commands

> Plan: `plans/2026-03-11-claude-switch-profile/plan.md`
> Depends on: Phase 2
> Parallel-safe: No — uses core library

---

## Objective

Implement all 9 CLI commands using Commander.js, each as a separate module in `src/commands/`.

---

## Task List

### Task 3.1 — `csp current` command

- **File**: `src/commands/current.js`
- **Action**: Read .active file, print current profile name. If none, print "No active profile". Show profile dir path.
- **Test**: `csp current` — outputs profile name or "No active profile"

### Task 3.2 — `csp list` command

- **File**: `src/commands/list.js`
- **Action**: Read profiles.json, list all profiles. Mark active with `*`. Show created date and description. Colored output with chalk.
- **Test**: `csp list` — shows formatted list

### Task 3.3 — `csp create <name>` command

- **File**: `src/commands/create.js`
- **Action**:
  - Create profile dir at ~/.claude-profiles/<name>
  - Save current symlink targets to source.json
  - Copy mutable files (settings.json, .env, .ck.json, etc.)
  - Copy dirs (commands/, plugins/)
  - Add to profiles.json with metadata (name, created, description)
  - Set as active if first profile
  - Support `--from <other>` to clone existing profile
  - Support `--description "text"` for metadata
- **Test**: `csp create test-profile` — creates profile dir with all files

### Task 3.4 — `csp save` command

- **File**: `src/commands/save.js`
- **Action**: Save current ~/.claude state to active profile. Update symlink targets in source.json + copy mutable files. Error if no active profile.
- **Test**: `csp save` — updates active profile files

### Task 3.5 — `csp use <name>` command

- **File**: `src/commands/use.js`
- **Action**: Switch to named profile:
  1. Validate target profile exists
  2. Auto-save current state to active profile (if any)
  3. Auto-backup current state to .backup/
  4. Remove managed symlinks from ~/.claude
  5. Remove managed files from ~/.claude
  6. Restore symlinks from target profile's source.json
  7. Restore files from target profile
  8. Update .active to new profile name
  9. Print success with instructions to restart Claude session
  - Support `--dry-run` flag — show what would change without executing
  - Support `--no-save` flag — skip saving current profile
- **Test**: `csp use work` — switches profile, symlinks updated

### Task 3.6 — `csp delete <name>` command

- **File**: `src/commands/delete.js`
- **Action**: Delete profile with confirmation prompt (use readline). Cannot delete active profile (must switch first). Remove dir and profiles.json entry. Support `--force` to skip confirmation.
- **Test**: `csp delete old-profile` — removes profile after confirmation

### Task 3.7 — `csp export <name>` command

- **File**: `src/commands/export.js`
- **Action**: Export profile as tar.gz. Include source.json + all files. Resolve symlink targets — follow symlinks and include actual files. Default output: `./<name>.csp.tar.gz`. Support `--output <path>`.
- **Test**: `csp export work` — creates tar.gz archive

### Task 3.8 — `csp import <file>` command

- **File**: `src/commands/import.js`
- **Action**: Import profile from tar.gz. Extract to ~/.claude-profiles/<name>. Support `--name <name>` to override profile name. Validate contents after import. Add to profiles.json.
- **Test**: `csp import work.csp.tar.gz` — creates profile from archive

### Task 3.9 — `csp diff <a> <b>` command

- **File**: `src/commands/diff.js`
- **Action**: Compare two profiles. Show which files differ (source.json targets, settings.json, .env). Use colored diff output. Support `--current` as alias for active profile.
- **Test**: `csp diff work personal` — shows differences

---

## Expected Outcome

- All 9 commands registered and functional
- `csp --help` shows all commands with descriptions
- Each command has proper error handling and user feedback
- `use` command safely switches profiles without data loss
