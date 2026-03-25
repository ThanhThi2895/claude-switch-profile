# Brainstorm: Default Profile, Multi-Launch, Performance

**Date:** 2026-03-25
**Status:** Agreed
**Platform focus:** Windows (PowerShell)

---

## Problem Statement

3 issues with CSP:

1. **Default profile copies 365MB** — should map directly to ~/.claude (pass-through, zero-copy)
2. **`csp launch` blocks re-launch** — "Claude is running" warning prevents opening multiple Claude instances with same profile
3. **`csp use` / `csp launch` extremely slow** — 10-27s on Windows due to copying 365MB (skills/ = 365MB including .venv 146MB, chrome-devtools 87MB, mcp-management 69MB)

### Performance Measurements (Windows PowerShell)

| Operation | Time | Acceptable? |
|---|---|---|
| `csp --help` | 51ms | ✓ |
| `csp current` | 53ms | ✓ |
| `csp create` | **16.7s** | ✗ |
| `csp use --no-save` | **10.3s** | ✗ |
| `csp use` (with save) | **26.9s** | ✗ |

Root cause: `skills/` = 365MB copied every switch. Contains `.venv` (146MB), `node_modules` in sub-skills (87MB+69MB).

---

## Issue 1: Default Profile = Live ~/.claude

### Current Behavior
`csp init` creates empty `~/.claude-profiles/default/` with `source.json = {}`. Switching TO default removes all managed items (vanilla reset). Switching FROM default saves current ~/.claude state into profile dir.

### Desired Behavior
"default" profile = direct alias to ~/.claude. No copy, no save, no restore. When active=default, Claude uses ~/.claude as-is.

### Approach: Skip-on-default

**Logic changes:**
- `csp use <X>` from default: **skip save step** (nothing to save — ~/.claude IS the profile)
- `csp use default` from X: save X, remove managed items, **skip restore** (files already in ~/.claude from previous state before any profile was created; OR just leave ~/.claude as-is after removing profile X's items)
- `csp save` while default active: **no-op** with info message
- `csp create` while default active: still works (captures current ~/.claude state into new profile)

**Implementation:**
```
if (active === 'default') skip save/restore
if (target === 'default') skip restore, just remove current profile's items
```

**Pros:**
- Zero-copy for default profile
- Backward compatible (existing profiles untouched)
- Simple conditional logic

**Cons:**
- "default" becomes a magic name — different behavior from other profiles
- User might expect `csp save` to work on default
- Edge case: user modifies ~/.claude manually while on non-default profile, then switches to default — state confusion

**Mitigation:**
- Clear messaging: "default profile maps directly to ~/.claude"
- `csp save` on default prints info: "Default profile uses ~/.claude directly. No save needed."
- `csp init` docs updated

### Alternative Considered: Symlink approach
Make `~/.claude-profiles/default` a junction/symlink to `~/.claude`. Rejected — introduces circular dependency risk and doesn't simplify anything (save/restore would still try to copy).

### Recommendation: **Skip-on-default** ✓

---

## Issue 2: Multi-Launch (Same Profile)

### Current Behavior
`csp launch X` calls `warnIfClaudeRunning()` inside `useCommand()`. This prints a warning but does NOT block. However, `launch` command itself doesn't guard against re-launch — the issue is:
1. First `csp launch X` switches profile, spawns Claude
2. Second `csp launch X` tries to switch (but already on X), then runs `useCommand` which detects Claude running → warning

Actually re-reading the code: `useCommand` checks `active === name` and returns early ("already active"). So second launch should work. Let me verify the actual blocker...

**Real issue:** `csp launch X` when X is already active:
- `useCommand` returns immediately (already active)
- But `warnIfClaudeRunning()` fires BEFORE the early return check
- The warning is just a `warn()` — non-blocking

Wait — looking at use.js line 37: `warnIfClaudeRunning()` is called AFTER the `active === name` early return (line 16-19). So if profile is already active, it never reaches the warning.

**Revised analysis:** The actual issue might be the lock file. `withLock()` blocks concurrent `csp use` operations. If two `csp launch` happen simultaneously, second one fails with "Another csp operation is running".

### Approach: Allow re-launch when already active

Current flow: `launch` → `useCommand(name)` → detects already active → returns → spawn Claude. This should work fine for second launch.

BUT: `csp launch X` also has post-exit restore logic (`restorePrevious`). If 2 launches are active and one exits, it restores the previous profile while the other Claude is still running.

**Fix:**
1. Track active launch count (or just detect if other Claude processes are running before restore)
2. Skip auto-restore if Claude is still running after exit
3. Better: make `launch` not restore at all — just switch and launch. User manages profile switching explicitly.

**Recommended approach:**
- `launch` should be simpler: switch (if needed) + spawn Claude. No auto-restore on exit.
- If user wants temporary switch, they can `csp use original-profile` manually after.
- This removes the entire restore complexity and the conflict with multi-instance.

**Pros:**
- Simpler code (remove restorePrevious entirely)
- Multiple launches with same profile just work
- No lock contention from restore on exit

**Cons:**
- User must manually restore profile after temp launch
- Breaking change in launch behavior

### Alternative: Reference counting
Track how many launch sessions are active. Only restore when last one exits. Complexity not worth it for a CLI tool.

### Recommendation: **Simplify launch** — remove auto-restore ✓

---

## Issue 3: Performance Optimization

### Root Cause Analysis

`~/.claude` = 373MB. Breakdown:
- `skills/` = 365MB (98% of total!)
  - `.venv/` = 146MB (Python venv)
  - `chrome-devtools/` = 87MB (node_modules)
  - `mcp-management/` = 69MB
  - `sequential-thinking/` = 36MB
  - 68 other skill dirs = ~27MB
- Everything else = ~8MB

Current approach: **full copy** of all MANAGED_ITEMS + COPY_ITEMS + COPY_DIRS on every save/restore. With `skills/` in MANAGED_ITEMS, every switch copies 365MB.

### Approaches Evaluated

#### A. Exclude .venv and node_modules from copy
Add filter to `cpSync` to skip `.venv`, `node_modules`, `__pycache__` inside skills.

**Pros:** Drops 300MB+ from copy. Switch time ~2-3s.
**Cons:** Skills with native deps might break if .venv/node_modules differ between profiles. BUT — skills are typically shared across profiles (same machine, same user), so .venv is universal.

#### B. Symlinks for large dirs (hybrid approach)
Instead of copying `skills/`, create a symlink/junction from profile to a shared location. Only copy skill config files, not the heavy dirs.

**Pros:** Near-instant switch. Shared .venv benefits all profiles.
**Cons:** More complex. Skill changes in one profile affect all (usually desired). Need to handle per-profile skill overrides.

#### C. Diff-based sync (rsync-like)
Only copy changed files. Use mtime comparison.

**Pros:** Subsequent switches fast (only changed files copied).
**Cons:** First switch still slow. Complex implementation. Hard to get right on Windows.

#### D. Move instead of copy (rename)
Use `fs.renameSync` instead of `cpSync`. On same filesystem, rename is O(1).

**Pros:** **Near-instant** regardless of size. Same filesystem = just inode pointer change.
**Cons:** Source gone after move (acceptable — profile dir IS the storage). Risk if interrupted mid-move. Need atomic swap pattern.

#### E. Hardlinks for files
Use hardlinks for files, copy only for dirs that need mutation.

**Pros:** Fast, space-efficient.
**Cons:** Hardlinks break on edit (copy-on-write not automatic on all FS). Dirs can't be hardlinked. Complex tracking.

### Performance Comparison (estimated for 365MB on Windows NTFS)

| Approach | Save time | Restore time | Disk usage |
|---|---|---|---|
| Current (copy) | 10-15s | 10-15s | 2x per profile |
| A. Filter .venv | 2-3s | 2-3s | 1.1x per profile |
| B. Symlink heavy | <100ms | <100ms | 1x shared |
| C. Diff sync | 1-10s | 1-10s | 2x per profile |
| **D. Move/rename** | **<100ms** | **<100ms** | **1x per profile** |
| E. Hardlinks | <1s | <1s | ~1x per profile |

### Recommended: **D. Move/rename** (primary) + **A. Filter** (fallback for cross-device)

**Strategy:**
1. Try `fs.renameSync(CLAUDE_DIR/item, profileDir/item)` — O(1) on same filesystem
2. If rename fails (EXDEV = cross-device), fall back to filtered copy (skip .venv, node_modules)
3. Restore: `fs.renameSync(profileDir/item, CLAUDE_DIR/item)`

**Why this works:**
- `~/.claude` and `~/.claude-profiles` are typically on same filesystem
- `renameSync` is atomic on same FS — just moves inode pointers
- For 365MB skills/ dir: 0ms vs 15s
- Fallback ensures it works even with exotic setups

**Save flow (new):**
```
for each managed item:
  try renameSync(~/.claude/item → profileDir/item)  // O(1)
  catch EXDEV: cpSync with filter, then rmSync
```

**Restore flow (new):**
```
for each managed item in source.json:
  rmSync(~/.claude/item)  // remove current
  try renameSync(profileDir/item → ~/.claude/item)  // O(1)
  catch EXDEV: cpSync with filter, then rmSync source
```

**Risk:** If process crashes mid-rename, item exists in neither location.
**Mitigation:** Rename items one-by-one. On failure, check both locations and recover. Backup mechanism already exists.

**Additional quick win — skip backup on every switch:**
Currently `createBackup()` copies all managed items before every switch. With 365MB, that's another 10-15s. Options:
- Skip backup entirely (rename approach makes it unnecessary — profile dir IS the backup)
- Or keep backup but only for COPY_ITEMS (8MB) not MANAGED_ITEMS

---

## Summary of Recommendations

| Issue | Solution | Effort | Impact |
|---|---|---|---|
| Default = ~/.claude | Skip-on-default logic | Small | UX clarity |
| Multi-launch | Remove auto-restore from launch | Small | Multi-instance works |
| Performance | Move/rename + filter fallback | Medium | **10-27s → <1s** |
| Backup perf | Skip backup for managed items (rename = reversible) | Small | Faster switch |

### Combined switch flow (optimized):

```
csp use <target>:
  1. if target === active → return
  2. if active !== 'default':
       moveItems(~/.claude → activeProfileDir)   // rename, O(1)
       saveFiles(activeProfileDir)                // copy ~8MB
  3. removeFiles(~/.claude)                       // remove COPY_ITEMS/DIRS
  4. if target !== 'default':
       moveItems(targetProfileDir → ~/.claude)    // rename, O(1)
       restoreFiles(targetProfileDir)             // copy ~8MB
  5. setActive(target)
```

Expected time: **<500ms** (vs current 10-27s)

---

## Next Steps

1. Implement skip-on-default logic in use.js, save.js, init.js
2. Replace cpSync with renameSync in item-manager.js (save/restore)
3. Simplify launch.js — remove restorePrevious
4. Update backup to skip MANAGED_ITEMS
5. Test on Windows PowerShell
6. Update docs

---

## Open Questions

- Should `csp create` from default also use move? (Would leave ~/.claude empty for managed items — probably not desired. Keep copy for create.)
- Should we add `--no-move` flag for users who want copy behavior?
- Profile created before this change have full copies. Migration needed? (No — rename works on existing profile dirs too.)
