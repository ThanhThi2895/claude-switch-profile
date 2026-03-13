# CSP Gaps & Issues Report

Date: 2026-03-12

## Summary

- **Total issues found**: 18
- **Critical (data loss / correctness)**: 4
- **High (logic bugs / silent failures)**: 6
- **Medium (gaps / edge cases)**: 5
- **Low (test coverage)**: 3

---

## ~/.claude Audit

### What exists in ~/.claude

```
agent-memory       ← NEVER_TOUCH ✓
backups            ← NEVER_TOUCH ✓
cache              ← NEVER_TOUCH ✓
.ck.json           ← COPY_ITEMS ✓
.ckignore          ← COPY_ITEMS ✓
commands/          ← COPY_DIRS ✓
.credentials.json  ← NEVER_TOUCH ✓
debug/             ← NEVER_TOUCH ✓
.env               ← COPY_ITEMS ✓
.env.example       ← !! NOT MANAGED, NOT NEVER_TOUCH
file-history/      ← NEVER_TOUCH ✓
.gitignore         ← !! NOT MANAGED, NOT NEVER_TOUCH
history.jsonl      ← NEVER_TOUCH ✓
ide/               ← NEVER_TOUCH ✓
agents -> ...      ← SYMLINK_ITEMS ✓
CLAUDE.md -> ...   ← SYMLINK_ITEMS ✓
hooks -> ...        ← SYMLINK_ITEMS ✓
.luna.json -> ...  ← SYMLINK_ITEMS ✓
paste-cache/       ← NEVER_TOUCH ✓
plans/             ← NEVER_TOUCH ✓ (but questionable — see below)
plugins/           ← COPY_DIRS ✓
projects/          ← NEVER_TOUCH ✓
rules -> ...       ← SYMLINK_ITEMS ✓
session-env/       ← NEVER_TOUCH ✓
settings.json      ← COPY_ITEMS ✓
shell-snapshots/   ← NEVER_TOUCH ✓
skills -> ...      ← SYMLINK_ITEMS ✓
statusline.cjs -> ...← SYMLINK_ITEMS ✓
tasks/             ← NEVER_TOUCH ✓
teams/             ← NEVER_TOUCH ✓
telemetry/         ← NEVER_TOUCH ✓
todos/             ← NEVER_TOUCH ✓
```

### Items Falling Through Cracks (not managed AND not in NEVER_TOUCH)

| Item | Type | Issue |
|------|------|-------|
| `.env.example` | file | Falls through — not managed, not NEVER_TOUCH |
| `.gitignore` | file | Falls through — not managed, not NEVER_TOUCH |

These items are silently ignored by CSP. On switch, they are neither saved nor removed. If `.gitignore` affects Claude Code behavior or is profile-specific, it would persist across profile switches incorrectly.

---

## Missing Managed Items

### 1. `.env.example` — neither managed nor excluded
Not profile-specific enough to copy, but also not pure runtime data. Should be added to NEVER_TOUCH to document the decision explicitly (`src/constants.js`).

### 2. `.gitignore` — neither managed nor excluded
Same situation. If it's global to all profiles, add to NEVER_TOUCH. If profile-specific, add to COPY_ITEMS.

### 3. `plans/` categorization is questionable
Currently in NEVER_TOUCH. But `~/.claude/plans/` contains agent plans that ARE session/project-specific. If a user wants a clean slate when switching profiles, these linger. This is probably intentional (plans span sessions) but undocumented — should be explicitly noted in README.

---

## Bugs Found

### BUG-1 [HIGH] `createSymlinks`: incorrect `lstatSync` error handling
**File**: `src/symlink-manager.js:43`

```js
try {
  if (lstatSync(itemPath)) unlinkSync(itemPath);
} catch {
  // Doesn't exist — fine
}
```

`lstatSync` throws `ENOENT` if the path doesn't exist, which is caught and silently swallowed. That's correct for ENOENT. However, `lstatSync` returns stats object (always truthy), so the condition `if (lstatSync(itemPath))` is always true when it doesn't throw — meaning it always calls `unlinkSync` without checking if it's actually a symlink vs a real file/dir. If a managed symlink item name exists as a REAL file (e.g., user manually created `~/.claude/CLAUDE.md` as a regular file), CSP will delete it silently without backing it up.

**Fix**: Use `existsSync` + `lstatSync` consistently (as done in `removeSymlinks`).

### BUG-2 [CRITICAL] Partial restore rollback only restores symlinks, not files
**File**: `src/commands/use.js:75-93`

```js
try {
  restoreSymlinks(profileDir);
  restoreFiles(profileDir);       // ← if this throws after restoreSymlinks succeeds
} catch (err) {
  // Rollback: restore from backup
  createSymlinks(backupMap);      // ← restores symlinks
  restoreFiles(backupPath);       // ← restores files from backup
}
```

If `restoreSymlinks` partially succeeds (e.g., creates 3 of 7 symlinks before an error), the rollback calls `createSymlinks(backupMap)` which only creates symlinks without first removing the partially-created new ones. This could leave mixed symlinks pointing to both old and new targets.

**Fix**: Call `removeSymlinks()` before `createSymlinks(backupMap)` in rollback.

### BUG-3 [HIGH] `setActive` called inside lock but after restore — not atomic with switch
**File**: `src/commands/use.js:97`

`setActive(name)` is called inside `withLock`, but `backupPath` computation, remove, and restore all happen before it. If the process crashes between `restoreFiles` and `setActive`, the active marker will still point to the old profile while `~/.claude` contains the new profile's files. On next `csp use`, it will try to "save" the wrong profile.

**Fix**: This is inherently hard to make fully atomic on a filesystem. At minimum, the rollback path should also reset the active marker to the previous active profile.

### BUG-4 [HIGH] `init` creates a clean profile instead of capturing current state
**File**: `src/commands/init.js:19`

```js
createCommand('default', { description: 'Default profile (initial capture)' });
```

`createCommand` with no `--from` or `--source` options takes the NEW independent profile path, which creates empty SYMLINK_DIRS and does NOT call `saveFiles()`. This means `csp init` does NOT actually capture the user's current settings.json, .env, etc. The README says "Captures your current Claude Code setup" but it actually creates a blank slate.

However this may be intentional per the recent commit `fa49c5d fix(create): produce clean profiles without inherited state`. The README description on `init` is then misleading and needs updating.

**Note**: If `init` IS supposed to capture current state, the fix is to call `saveFiles(profileDir)` and `saveSymlinks(profileDir)` explicitly after creating the profile dir instead of relying on `createCommand`.

### BUG-5 [MEDIUM] `profileExists` checks directory, `profiles.json` may be out of sync
**File**: `src/profile-store.js:49-51`

```js
export const profileExists = (name) => {
  return existsSync(getProfileDir(name));
};
```

If a user manually deletes a profile directory without using `csp delete`, the profile still appears in `profiles.json` (via `readProfiles`/`listProfileNames`). Conversely, if a profile directory exists but wasn't registered in `profiles.json`, `profileExists` returns true but `listProfileNames` won't list it.

The `list` command uses `readProfiles()` while `profileExists` uses filesystem. These two can diverge silently.

### BUG-6 [MEDIUM] `import` derives profile name from filename without validation
**File**: `src/commands/import.js:16`

```js
const name = options.name || basename(file).replace(/\.csp\.tar\.gz$/, '').replace(/\.tar\.gz$/, '');
```

If the archive is named `my.profile.tar.gz`, derived name is `my.profile` which contains a dot and would fail `validateName()` (which requires `[a-zA-Z0-9_-]` only) — but `validateName` is only called inside `getProfileDir`. This means `profileExists(name)` calls `getProfileDir(name)` which calls `validateName` and **throws** an unhandled exception with a confusing stack trace instead of a user-friendly error message.

**Fix**: Validate/sanitize derived name before proceeding, emit clear error.

### BUG-7 [LOW] `use --no-save` option check is fragile
**File**: `src/commands/use.js:60`

```js
if (active && profileExists(active) && options.save !== false) {
```

Commander's `--no-save` sets `options.save = false`. This works correctly. However, the default value of `options.save` when flag is absent is `true` (Commander's boolean option default). The check `options.save !== false` is correct but unconventional — it should be documented or refactored to `if (active && profileExists(active) && options.save)` which reads more clearly.

### BUG-8 [CRITICAL] `uninstall`: removes PROFILES_DIR outside the lock, then lock file is already gone
**File**: `src/commands/uninstall.js:80-81`

```js
  }); // ← lock released here; PROFILES_DIR still exists

  // 5. Remove profiles directory (after lock is released)
  rmSync(PROFILES_DIR, { recursive: true, force: true });
```

The lock is in PROFILES_DIR. After `withLock` finishes, the lock is released (lock file deleted). Then PROFILES_DIR is deleted. This is intentional since you can't hold a lock in a dir you're about to delete. BUT: if a second `csp` process starts between lock release and `rmSync`, it could acquire the lock on the now-about-to-be-deleted directory, and both processes will race on `rmSync`. Low probability in practice but worth noting.

More importantly: the final backup was created INSIDE the lock. The `backupPath` is inside `PROFILES_DIR` which then gets deleted by `rmSync`. The user is told "Final backup created at ..." but that backup is immediately deleted. This is a **data loss risk** — the final backup is useless.

### BUG-9 [MEDIUM] `diff` doesn't recurse into COPY_DIRS subdirectories
**File**: `src/commands/diff.js:45-46`

```js
const filesA = new Set(readdirSync(dirA).filter((f) => f !== SOURCE_FILE));
```

`readdirSync` is non-recursive. For `commands/` and `plugins/` directories inside profiles, `diff` only detects presence/absence of the directory but not content changes inside them. It falls into the `catch` block (line 69) with "could not compare (directory?)" which is misleading.

---

## Edge Cases Not Handled

### EC-1: COPY_ITEMS file that became a directory
If `~/.claude/settings.json` is a directory (corrupted state), `copyFileSync` in `saveFiles` will throw. No specific error message is given, the whole save/switch fails.

### EC-2: Symlink pointing to another symlink (nested symlinks)
`readCurrentSymlinks` resolves the symlink with `resolve()`, but if the target is itself a symlink, it captures the absolute path of the intermediate symlink, not the final target. When restoring on a different machine, the intermediate path may not exist.

### EC-3: Profile name collision with metadata files
Profile names like `.active`, `.lock`, `.backup`, `profiles` are not blocked by `validateName` (which only checks `[a-zA-Z0-9_-]`). A profile named `profiles` would conflict with `profiles.json`, though the directory and file won't conflict directly. More concerning: the `.active` and `.lock` files use dotfile names — a profile named `.active` would be blocked by validateName (dot not allowed), so this is safe. Names like `backup` are NOT blocked but `.backup` IS the backup dir name (dotfile). This appears safe due to the dot prefix on metadata files.

### EC-4: Concurrent CSP instances — lock is per-PROFILES_DIR, not per-machine
If two users share the same `~/.claude-profiles/` (e.g., shared home directory on a server), the lock works. But the `~/.claude` directory is also shared, so switching profile for one user affects the other. This is an unusual use case but could cause data loss.

### EC-5: `saveFiles` called during `create --from` cloning
When `create --from source` is used, it first `cpSync`s the entire source profile, which includes `source.json` pointing to the source profile's symlink targets. This is correct. But `saveFiles` is not called for `--from`, so mutable files from `~/.claude` are NOT captured into the clone. The clone gets the source profile's files, not the current `~/.claude` state. This is probably intentional but undocumented.

---

## Data Loss Risks

### DL-1 [CRITICAL] Final backup deleted during uninstall
**File**: `src/commands/uninstall.js:54-58, 80-81`

`createBackup()` writes to `PROFILES_DIR/.backup/`. Then `rmSync(PROFILES_DIR)` deletes everything including that backup. The user is shown the backup path but it's gone immediately after. If restore fails (e.g., symlink target missing), user has no fallback.

**Fix**: Create the final backup outside `PROFILES_DIR`, e.g., in `~/.claude-profiles-backup-{timestamp}/`, or print explicit warning that the backup inside PROFILES_DIR will be deleted.

### DL-2 [HIGH] Auto-save before switch can overwrite a manually crafted profile
If user manually edits `~/.claude-profiles/myprofile/settings.json` directly and then does `csp use myprofile`, the `use` command first saves the CURRENT `~/.claude/settings.json` over `myprofile/settings.json` (step 1 in `use.js`), then restores from myprofile. The manually edited version is lost.

Actually wait — re-reading: step 1 saves the ACTIVE profile (not the target). Step 3 restores the TARGET. So the target's manual edits ARE preserved. This is NOT a bug, but it means the active profile's manually-edited snapshot IS overwritten by current state (intended behavior).

**Revised**: DL-2 is actually the expected behavior. Not a bug. Removing from critical list.

### DL-3 [HIGH] `removeFiles` during switch deletes files before backup is complete
**File**: `src/commands/use.js:67-73`

```js
const backupPath = createBackup();    // ← backup created
removeSymlinks();                      // ← symlinks removed
removeFiles();                         // ← files removed from ~/.claude
```

Order is: backup → remove → restore. This is safe. However `createBackup` silently fails on `cpSync` errors (it's inside a try/catch in safety.js? — no, actually `createBackup` does NOT have a try/catch around the individual copy operations). If `createBackup` partially fails (e.g., disk full), the partial backup is used, then files are deleted. The partial backup may be missing items.

---

## Test Coverage Gaps

### TC-1: No test for `use` command with actual module calls
The integration tests test `use` via CLI (`run('use keeper --no-save', envOverrides)`), but only test that the command runs without a real `~/.claude` setup with symlinks. The symlink restore path is not exercised in integration tests.

### TC-2: Rollback path (BUG-2) is not tested
No test simulates `restoreFiles` throwing after `restoreSymlinks` succeeds, to verify rollback behavior.

### TC-3: Concurrent lock acquisition not tested
No test verifies that a second `csp` process is blocked when a lock is held.

### TC-4: `init` command behavior not tested
No integration test verifies `init` creates the right profile structure or that running it twice is idempotent.

### TC-5: `diff` command not tested
No test for `diff` output format or content comparison accuracy.

### TC-6: Profile name derived from archive filename not tested
No test for `import` with a filename that produces an invalid profile name.

### TC-7: `saveFiles` + `restoreFiles` round-trip with actual module calls
Core library tests simulate file operations manually with raw fs calls, not through the actual module functions. A bug in the module functions themselves wouldn't be caught.

---

## Recommendations

### Priority 1 — Fix (data loss risks)

1. **DL-1 / BUG-8**: Move final backup outside `PROFILES_DIR` before deleting it in `uninstall`, or warn user it will be deleted. (`src/commands/uninstall.js`)

2. **BUG-2**: Add `removeSymlinks()` call before `createSymlinks(backupMap)` in the rollback path. (`src/commands/use.js:82-84`)

3. **BUG-1**: Replace `if (lstatSync(itemPath))` with `existsSync(itemPath) && lstatSync(itemPath).isSymbolicLink()` in `createSymlinks`. (`src/symlink-manager.js:42-44`)

### Priority 2 — Fix (correctness bugs)

4. **BUG-4**: Clarify `init` intent — either update README to say "clean slate" or make `init` actually capture current state via explicit `saveSymlinks` + `saveFiles` calls.

5. **BUG-5**: Add consistency check in `list` command — warn if profile directory exists without `profiles.json` entry or vice versa.

6. **BUG-6**: Sanitize/validate derived profile name from filename in `import` before calling `getProfileDir`. (`src/commands/import.js:16`)

7. **BUG-3**: In rollback, reset active marker to previous active profile to prevent desync.

### Priority 3 — Gaps & edge cases

8. **EC-1 / Missing items**: Add `.env.example` and `.gitignore` to `NEVER_TOUCH` in `src/constants.js` to explicitly document the decision.

9. **BUG-9**: Add recursive directory comparison in `diff` command for `COPY_DIRS`. (`src/commands/diff.js`)

10. **EC-5**: Document `--from` clone behavior in README — clarify it clones the profile's saved state, not current `~/.claude`.

### Priority 4 — Test coverage

11. Add rollback path test (simulate `restoreFiles` throwing mid-switch).

12. Add `init` idempotency test.

13. Add round-trip test using actual module functions (`saveFiles` → `restoreFiles`).

---

## Unresolved Questions

1. Is `init` intentionally creating a clean profile (not capturing current state)? The README description contradicts the implementation. The recent commit message suggests clean-profile behavior is intentional for `create`, but `init` documentation says "initial capture".

2. Should `plans/` in `~/.claude/` be profile-specific (managed) or global (NEVER_TOUCH)? Current behavior leaves plans from one profile visible in another.

3. Is `.env.example` a Claude Code file or user-created? If Claude Code creates it, should it be NEVER_TOUCH?

4. For the `diff` command: should it do a deep recursive comparison of `commands/` and `plugins/` directory content, or is top-level presence sufficient?
