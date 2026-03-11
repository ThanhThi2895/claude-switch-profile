# Phase 2: Core Library

> Plan: `plans/2026-03-11-claude-switch-profile/plan.md`
> Depends on: Phase 1
> Parallel-safe: No — builds on constants

---

## Objective

Implement the core library modules: profile store (CRUD for profiles.json + .active), symlink manager, file operations, and profile validation.

---

## Task List

### Task 2.1 — Profile store (metadata management)

- **File**: `src/profile-store.js`
- **Action**: Create module with functions:
  - `ensureProfilesDir()` — create ~/.claude-profiles if missing
  - `readProfiles()` — read profiles.json, return object
  - `writeProfiles(data)` — write profiles.json
  - `getActive()` — read .active file, return string or null
  - `setActive(name)` — write .active file
  - `addProfile(name, metadata)` — add entry to profiles.json
  - `removeProfile(name)` — remove entry from profiles.json
  - `profileExists(name)` — check if profile dir exists
  - `getProfileDir(name)` — return full path to profile dir
- **Test**: Unit test all CRUD operations with temp dir

### Task 2.2 — Symlink manager

- **File**: `src/symlink-manager.js`
- **Action**: Create module with functions:
  - `readCurrentSymlinks()` — read current symlink targets from ~/.claude for SYMLINK_ITEMS, return source.json-format object
  - `removeSymlinks()` — remove all managed symlinks from ~/.claude
  - `createSymlinks(sourceMap)` — create symlinks in ~/.claude from source.json map
  - `saveSymlinks(profileDir)` — save current symlink targets to profileDir/source.json
  - `restoreSymlinks(profileDir)` — read source.json from profileDir and create symlinks
  - Handle case where item is regular file/dir (not symlink) — read source.json target, skip if no target
- **Test**: Create temp dirs, verify symlinks created/removed correctly

### Task 2.3 — File operations (copy-based items)

- **File**: `src/file-operations.js`
- **Action**: Create module with functions:
  - `saveFiles(profileDir)` — copy COPY_ITEMS files + COPY_DIRS dirs from ~/.claude to profileDir
  - `restoreFiles(profileDir)` — copy files + dirs from profileDir back to ~/.claude
  - `removeFiles()` — remove managed COPY_ITEMS files from ~/.claude (before restore)
  - Use `fs.cpSync` for dirs with recursive option
  - Skip missing files gracefully (not all profiles need .env)
- **Test**: Create temp files, verify copy operations

### Task 2.4 — Profile validator

- **File**: `src/profile-validator.js`
- **Action**: Create module with functions:
  - `validateProfile(name)` — check profile dir exists, has source.json, return {valid, errors[]}
  - `validateSourceTargets(sourceMap)` — check all symlink targets exist on disk
  - `listManagedItems(profileDir)` — list what files/symlinks a profile contains
- **Test**: Validate good/bad profiles, check error messages

---

## Expected Outcome

- All 4 modules export clean APIs
- Symlink operations are idempotent (safe to run twice)
- File copy handles missing files gracefully
- Validation catches broken symlink targets
