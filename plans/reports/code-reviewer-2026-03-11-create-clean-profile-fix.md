# Code Review: Create Clean Profile Fix

## Scope
- **Files changed**: `src/commands/create.js`, `src/constants.js`, `src/safety.js`
- **LOC changed**: ~25 (net +10)
- **Focus**: Bug fix -- `csp create <name>` (no flags) should produce a clean profile with no inherited files
- **Scout scope**: `use.js`, `save.js`, `file-operations.js`, `symlink-manager.js`, `profile-validator.js`, tests

## Overall Assessment

The fix correctly addresses the core bug: `saveFiles(profileDir)` and `saveSymlinks(profileDir)` are no longer called in the default create path, so a new profile will not inherit `settings.json`, `.env`, `.ck.json`, `.ckignore`, or current symlink targets from `~/.claude`. The replacement logic creates empty self-contained directories for symlink items and writes a valid `source.json`.

However, the fix has a dead import and breaks 2 existing integration tests.

---

## High Priority

### 1. Two CLI integration tests are broken

Running `node --test tests/*.test.js` produces 2 failures:

**Test: "create captures current state"** (`cli-integration.test.js:63`)
- Asserts `existsSync(join(profilesDir, 'testprofile', 'settings.json'))` -- now false because `saveFiles()` is no longer called
- The test name and assertion reflect old behavior; must be updated to match new semantics

**Test: "create --from clones existing profile"** (`cli-integration.test.js:104`)
- Creates `original` profile via default path (now clean), then reads `settings.json` from original -- file does not exist
- Fails with `ENOENT` on line 112

**Recommended fix**: Update "create captures current state" test to assert `settings.json` does NOT exist and that empty `SYMLINK_DIRS` directories DO exist. For the `--from` test, either (a) create the original profile with `--from` a pre-seeded profile, or (b) manually write `settings.json` into the original profile dir before cloning, or (c) adjust the assertion to not expect `settings.json` when cloning a clean profile.

### 2. Dead import: `saveSymlinks`

`saveSymlinks` is imported on line 4 of `create.js` but is no longer called anywhere in the file. It was removed from the default branch, and neither `--from` nor `--source` branches use it. Should be removed to avoid confusion.

```js
// Line 4 — remove this import
import { saveSymlinks } from '../symlink-manager.js';
```

---

## Medium Priority

### 3. `SYMLINK_DIRS` duplication with `SYMLINK_ITEMS`

New constant `SYMLINK_DIRS = ['rules', 'agents', 'skills', 'hooks']` in `constants.js` is a subset of `SYMLINK_ITEMS`. These must be kept in sync manually. If a new directory-type item is added to `SYMLINK_ITEMS` but not `SYMLINK_DIRS`, a clean profile won't create the directory for it.

Options:
- Acceptable as-is for a 4-item list, but add a comment linking the two constants
- Or derive programmatically (less practical since file vs dir is not encoded elsewhere)

### 4. Switching to a clean profile removes settings/env from `~/.claude`

When `csp use <clean-profile>` runs, `use.js` calls `removeFiles()` (deletes settings.json, .env, etc. from `~/.claude`) then `restoreFiles(profileDir)` (no-ops because clean profile has none). Result: `~/.claude` loses its settings.json and .env.

This is logically correct for a "clean" profile, but could surprise users. Worth documenting in help text or a warning during `csp use` when the target profile has no mutable files. Not a bug -- just UX consideration.

### 5. `--source` path still calls `saveFiles()`

Line 54 in the `--source` branch calls `saveFiles(profileDir)`, copying current `settings.json`, `.env`, etc. into the new profile. Per the bug report, this is intentional (only the no-flags path should be clean). Flagging for awareness -- `--source` profiles inherit mutable files from the current state.

---

## Low Priority

### 6. Unrelated change: `MAX_BACKUPS` 5 -> 2

`safety.js` changes `MAX_BACKUPS` from 5 to 2. This is unrelated to the create fix. Should be committed separately or at least documented in commit message.

### 7. `source.json` for clean profiles contains absolute paths to profile dir

The `source.json` written for a clean profile stores absolute paths like `/home/user/.claude-profiles/myprofile/rules`. This is fine for local use but makes profiles non-portable (export/import to different machine). The existing `--source` path has the same pattern, so this is consistent.

---

## Edge Cases Found by Scouting

1. **`csp save` after switching to clean profile**: If user switches to a clean profile, makes changes to `~/.claude/settings.json`, then runs `csp save`, the `saveCommand` calls both `saveSymlinks()` and `saveFiles()`. This will correctly capture the new state. No issue.

2. **`validateProfile` on clean profile**: Requires `source.json` to exist. The fix writes `source.json` with directory entries, so validation passes.

3. **`validateSourceTargets` on clean profile**: Iterates `source.json` entries and checks `existsSync(target)`. The dirs are created inside the profile dir, so targets exist. Passes.

4. **`csp create <name> --from <clean-profile>`**: Will `cpSync` the entire clean profile dir (empty dirs + source.json). Produces another clean profile. Correct.

5. **`createSymlinks` filter**: Line 39 of `symlink-manager.js` checks `SYMLINK_ITEMS.includes(item)`. All 4 `SYMLINK_DIRS` items are in `SYMLINK_ITEMS`. Passes.

---

## Positive Observations

- Clear intent comments explaining why `saveFiles()` is not called
- Self-contained directories mean `csp use` works immediately without external targets
- `source.json` is always written, ensuring profile validation passes
- Fix is minimal and focused on the reported bug

---

## Recommended Actions

1. **[HIGH]** Fix 2 broken integration tests in `cli-integration.test.js`
2. **[HIGH]** Remove dead `saveSymlinks` import from `create.js` line 4
3. **[MED]** Add comment in `constants.js` linking `SYMLINK_DIRS` to `SYMLINK_ITEMS`
4. **[LOW]** Commit `MAX_BACKUPS` change separately or note in commit message

## Metrics

- Type Coverage: N/A (plain JS, no TypeScript)
- Test Coverage: 32/34 pass (2 failures from this change)
- Linting Issues: 1 (unused import)

## Unresolved Questions

1. Should `--source` also skip `saveFiles()` for consistency, or is inheriting mutable files intentional there?
2. Should `csp use` warn when switching to a profile with no mutable files (settings.json etc.)?
