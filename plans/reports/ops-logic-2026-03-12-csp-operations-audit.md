# CSP Operations & Logic Audit

## Summary

All 34 tests pass (8 suites). Core logic is sound. Identified **5 issues** — 2 medium severity, 3 low severity. No critical bugs. The `use` command is well-implemented with rollback support. Main concerns are: `init` skips locking, `diff` crashes on directory entries, `removeFiles` uses `existsSync` without handling symlinks, and `create --source` copies mutable files unexpectedly.

---

## Command-by-Command Analysis

### init

**Flow:** Check if already initialized → `ensureProfilesDir()` → call `createCommand('default', ...)`.

**Correctness:** Mostly correct. Two conditions checked independently — `existsSync(PROFILES_DIR) && getActive()` — meaning if dir exists but no active file, init proceeds and calls `createCommand` which calls `saveFiles`. This is correct behavior.

**Issues:**
- **[LOW]** `init` does not acquire a lock. If two `init` calls race, they could both read "no active" and both try to create "default", causing the second to hit `profileExists` check and `process.exit(1)`. Unlikely in practice but inconsistent with `use`/`uninstall`.
- **[LOW]** Delegates to `createCommand` which calls `process.exit(1)` on failure. `init` has no way to catch this.

---

### create

**Flow:** Validate name via `getProfileDir` → branch on `--from`, `--source`, or fresh → `addProfile()` → maybe `setActive()`.

**Branch: `--from` (clone)**
- Uses `cpSync(sourceDir, profileDir, { recursive: true })` — correct, copies everything including `source.json`.

**Branch: `--source` (kit link)**
- Builds `sourceMap` from items found in the kit dir.
- Calls `saveFiles(profileDir)` — **copies current mutable state** (settings.json, .env, etc.) into the new profile.
- **[MEDIUM]** This is inconsistent with the "fresh" branch comment "Do NOT call saveFiles() — new profile should start clean". A `--source` profile inherits current mutable state, which may or may not be intended. No documentation makes this behavior explicit.

**Branch: fresh (default)**
- Creates empty dirs for `SYMLINK_DIRS` only: `rules`, `agents`, `skills`, `hooks`.
- `source.json` maps these 4 dirs; `CLAUDE.md`, `statusline.cjs`, `.luna.json` are absent from the map.
- **[LOW]** When switching to a fresh profile, those 3 symlink items won't be created (createSymlinks skips non-existent targets). This is by design for a clean profile but could confuse users expecting all symlink slots to be populated.

**setActive logic:**
- Only sets active if `!getActive()`. Correct — won't overwrite existing active on subsequent creates.

---

### use

**Flow:** Validate profile exists → check already active → `validateProfile()` → `validateSourceTargets()` → dry-run check → `warnIfClaudeRunning()` → lock → save current → backup → remove all → restore all → `setActive()`.

**Save current state (step 1):**
- Condition: `active && profileExists(active) && options.save !== false`
- Calls `saveSymlinks(activeDir)` + `saveFiles(activeDir)` — saves both symlink targets and mutable files. Complete.

**Removal (step 2):**
- `removeSymlinks()` — iterates `SYMLINK_ITEMS`, removes only actual symlinks (checks `isSymbolicLink()`). Safe.
- `removeFiles()` — iterates `COPY_ITEMS` + `COPY_DIRS`, calls `existsSync()` then `unlinkSync`/`rmSync`. **[LOW]** `existsSync` follows symlinks. If a COPY_ITEM happens to be a symlink (unlikely but possible), it will be removed. This is acceptable given COPY_ITEMS are supposed to be plain files, but no explicit symlink check exists here unlike `removeSymlinks`.

**Restore (step 3):**
- `restoreSymlinks(profileDir)` → reads `source.json` → `createSymlinks(sourceMap)` → skips items whose targets don't exist. Correct.
- `restoreFiles(profileDir)` → copies COPY_ITEMS and COPY_DIRS from profile to `~/.claude`. Correct.

**Rollback:**
- On restore failure, reads `source.json` from backup and calls `createSymlinks` + `restoreFiles(backupPath)`. Correct and complete.

**Active marker:**
- Updated after successful restore. Correct ordering — marker only advances if switch fully succeeded.

**--no-save option:**
- Passed as `options.save !== false` — Commander's `--no-save` sets `options.save = false`. Correct.

**--dry-run:**
- Returns before any mutations. Correct. Note: does not call `warnIfClaudeRunning()` in dry-run mode (it's below the dry-run check), which is intentional and correct.

---

### save

**Flow:** Get active → validate active exists → `saveSymlinks` + `saveFiles`. Simple, correct.

**Issue:** No lock acquired. Concurrent `save` + `use` could race. Low impact since save is user-initiated.

---

### list

**Flow:** `readProfiles()` → `getActive()` → render. Reads from `profiles.json`, not from filesystem. **[LOW]** If a profile directory is manually deleted but the entry remains in `profiles.json`, `list` shows it without a warning. No staleness check.

---

### current

Simple read of `.active` file. Correct, no issues.

---

### delete

**Flow:** Validate exists → block if active → optional confirm → `rmSync(profileDir)` → `removeProfile(name)`.

- Correctly blocks deletion of active profile.
- `rmSync` uses `force: true` — won't fail if dir is partially deleted.
- Removes from `profiles.json` after dir removal. If `rmSync` fails, `removeProfile` won't run, leaving a stale entry. Low risk given `force: true`.

---

### diff

**Flow:** Resolve "current" alias → validate both profiles exist → compare `source.json` → compare files.

**File comparison:**
- Reads files with `readFileSync(path, 'utf-8')`. For directories (e.g., `commands/`, `plugins/`), this throws and is caught → shows `"could not compare (directory?)"`.
- **[MEDIUM]** Directories are not recursively diffed — only flagged as "could not compare". Users get no detail on directory content differences between profiles.

**Robustness:** `readJsonSafe` returns `{}` on parse error, preventing crashes.

---

### export

Uses `tar -czf`. Correct. No `source.json` validation before export — could export a broken profile, but `import` validates on the other side.

---

### import

**Flow:** Resolve path → derive name → validate name doesn't exist → `tar -xzf` → `validateProfile()` → `addProfile()`.

- Validation after extraction — warns but doesn't block on issues. This is correct (import completes, user can fix).
- Name derived from filename with `.csp.tar.gz` and `.tar.gz` stripped. Correct.
- No `validateName()` called on derived name. If filename contains invalid chars (spaces, dots), `getProfileDir` → `validateName` will throw inside `profileExists`. This is caught implicitly since `profileExists` is called before the extraction.

---

### uninstall

**Flow:** Check if initialized → show plan → optional confirm → lock → backup → `removeSymlinks` + `removeFiles` → restore chosen profile → release lock → `rmSync(PROFILES_DIR)`.

- Backup created before removal. Correct.
- `PROFILES_DIR` removal happens after lock release (lock file is inside PROFILES_DIR). Correct ordering — lock is released before the dir is deleted.
- `--profile` option allows choosing which profile to restore. Correct.
- If no profile to restore, managed items are just cleared. Documented in output. Correct.

---

## Profile Switching Deep-Dive

The `use` command performs a complete, safe switch:

1. **Pre-flight**: profile existence check → `validateProfile` (dir + source.json exists) → `validateSourceTargets` (symlink targets exist on disk) → optional `--force` bypass.
2. **State preservation**: saves current active profile's symlinks (`source.json`) and mutable files before any destructive action.
3. **Atomic-ish switch**: backup → remove all managed items → restore from target. Rollback on failure.
4. **Lock**: `withLock` uses O_EXCL atomic write, stale-PID detection. Prevents concurrent switches.
5. **Active marker**: written last, only on success.

The switch is **not truly atomic** (no filesystem transaction), but the backup+rollback strategy provides adequate recovery. The ordering is safe: save → backup → remove → restore → mark-active.

---

## Safety Mechanisms

**Lock file (`acquireLock`):**
- Uses `writeFileSync` with `{ flag: 'wx' }` — O_EXCL ensures atomicity at OS level.
- Stale lock detection: reads PID, checks with `process.kill(pid, 0)`. Correct.
- Race condition: between `unlinkSync(lockPath)` and re-create `writeFileSync` with `wx`, another process could acquire. Narrow TOCTOU window but not fully eliminated. Acceptable for CLI tool.

**Backup:**
- Saves `source.json`, all `COPY_ITEMS`, all `COPY_DIRS`.
- Pruned to `MAX_BACKUPS = 2`. Sorted by ISO timestamp string — lexicographic sort works correctly for ISO dates.
- Backup stored in `PROFILES_DIR/.backup/` — inside the profiles dir, so uninstall cleans it up.

**Validation:**
- `validateProfile`: checks dir exists + `source.json` present.
- `validateSourceTargets`: checks all target paths exist on disk.
- `validateName`: regex `/^[a-zA-Z0-9_-]+$/` — prevents path traversal. Correct.

---

## Test Results

```
# tests 34
# suites 8
# pass 34
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1041.867508
```

All tests pass. Coverage includes: CLI integration (11 tests), profile store (5), symlink manager (4), file operations (4), profile validator (5), full switch cycle (1), lock file (3), backup (1).

**Coverage gaps:**
- `diff` command not tested
- `export`/`import` round-trip tested at CLI level only, no unit test for malformed archives
- `uninstall` command not tested
- `create --source` path not tested
- Rollback path in `use` not tested
- `--no-save` flag not tested

---

## Issues Found

**MEDIUM**

1. **`create --source` unexpectedly inherits mutable files**: When using `--source <path>`, `saveFiles(profileDir)` is called, copying current `settings.json`, `.env`, `.ck.json`, `.ckignore`, `commands/`, `plugins/` into the new profile. This contradicts the "clean profile" philosophy applied to the default branch and is undocumented. May surprise users who expect a clean slate.

2. **`diff` does not recurse into directories**: When both profiles have `commands/` or `plugins/` directories, diff reports "could not compare (directory?)" instead of performing a recursive content comparison. Limits usefulness of `diff` for profiles with `COPY_DIRS`.

**LOW**

3. **`init` skips locking**: Unlike `use` and `uninstall`, `init` does not acquire a lock. Concurrent `init` calls could race. Mitigated by `profileExists` check in `createCommand` which exits on conflict.

4. **`list` shows stale entries**: No check that profile directories actually exist on disk. Manually deleted profiles remain visible in `list` until `profiles.json` is edited.

5. **Fresh profile omits non-directory SYMLINK_ITEMS**: `create` (fresh) only maps `SYMLINK_DIRS` (`rules`, `agents`, `skills`, `hooks`) in `source.json`. `CLAUDE.md`, `statusline.cjs`, `.luna.json` are not present. When switching to such a profile, those items get no symlink. Intentional for a clean profile, but not documented.

---

## Recommendations

1. **[MEDIUM - fix]** `create --source`: Either document the mutable-file inheritance behavior explicitly, or add an `--clean` flag to skip `saveFiles()`, or mirror the fresh-profile approach and skip `saveFiles()` by default for `--source`.

2. **[MEDIUM - fix]** `diff` directories: Implement recursive directory comparison (or at minimum, list files that differ within subdirs) instead of the current "could not compare" fallback.

3. **[LOW - consider]** `list` staleness: Add a check in `listCommand` (or `readProfiles`) that cross-references `profiles.json` entries with actual directories, marking missing ones as `[missing]`.

4. **[LOW - consider]** Lock in `init`: Wrap the create-default logic in `withLock` for consistency.

5. **[LOW - docs]** Document fresh-profile behavior: Clarify in README that fresh profiles start with only `rules/`, `agents/`, `skills/`, `hooks/` symlinked, and no mutable files copied.

6. **[TEST - add]** Add tests for: `diff`, `uninstall`, `create --source`, rollback path, `--no-save` flag.
