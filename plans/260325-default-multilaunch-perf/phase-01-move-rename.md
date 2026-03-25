# Phase 1: Move/Rename Item Manager

## Overview
- **Priority:** P1 — biggest perf impact
- **Status:** Pending
- **Effort:** 2h (revised from 1.5h — additional commands to update)

Replace copy-based save/restore with rename for O(1) profile switching. Split into **copy** (for save/create/export) and **move** (for switch only).

## Key Insight

`~/.claude` and `~/.claude-profiles` on same filesystem → `renameSync` = inode pointer move = O(1).

Current: copy 365MB (10-27s) → New: rename (< 100ms)

**CRITICAL DESIGN:** Two distinct operations:
- **`copyItems(profileDir)`** — copy from ~/.claude to profileDir. Used by: `save`, `create`, `export`, `diff`. ~/.claude UNCHANGED.
- **`moveItems(src, dest)`** — rename from src to dest. Used by: `use` command only (save-before-switch + restore-target). Source EMPTY after.

## Related Code Files

- **Modify:** `src/item-manager.js` — add moveItem helper, split copyItems/moveItemsToProfile/moveItemsToClaude
- **Modify:** `src/file-operations.js` — same split for COPY_DIRS (moveDir helper)
- **Modify:** `src/commands/use.js` — use moveItems instead of saveItems+restoreItems
- **Modify:** `src/commands/diff.js` — use getEffectiveDir for active profile
- **Modify:** `src/commands/export.js` — use getEffectiveDir for active profile
- **Modify:** `src/safety.js` — simplify backup (only COPY_ITEMS)
- **Modify:** `src/profile-store.js` — add getEffectiveDir helper
- **Keep:** `src/commands/save.js` — still uses copyItems (no change to behavior, just import name)
- **Keep:** `src/commands/create.js` — has own copy logic, unaffected

## Implementation Steps

### 1. Add moveItem helper to item-manager.js

```js
import { renameSync, mkdirSync, existsSync, rmSync, cpSync, basename } from 'node:fs';
import { dirname } from 'node:path';

const SKIP_PATTERNS = ['.venv', 'node_modules', '__pycache__', '.git'];

const skipHeavyDirs = (src) => !SKIP_PATTERNS.includes(basename(src));

const moveItem = (src, dest) => {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  try {
    renameSync(src, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      cpSync(src, dest, { recursive: true, filter: skipHeavyDirs });
      rmSync(src, { recursive: true, force: true });
    } else throw err;
  }
};
```

### 2. Keep existing saveItems as copyItems (rename for clarity)

Current `saveItems` = copy. Rename to `copyItems` but keep copy behavior:
```js
// Copy items from ~/.claude → profileDir (non-destructive)
export const copyItems = (profileDir) => {
  // ... existing copy logic (cpSync/copyFileSync) — unchanged ...
};

// Alias for backward compatibility in save.js
export const saveItems = copyItems;
```

### 3. Add moveItemsToProfile (for use.js save-before-switch)

```js
// Move items from ~/.claude → profileDir (destructive — items leave ~/.claude)
export const moveItemsToProfile = (profileDir) => {
  const sourceMap = {};
  for (const item of MANAGED_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    if (!existsSync(itemPath)) continue;
    try {
      const dest = join(profileDir, item);
      moveItem(itemPath, dest);
      sourceMap[item] = dest;
    } catch { /* skip */ }
  }
  writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
  return sourceMap;
};
```

### 4. Add moveItemsToClaude (for use.js restore-target)

```js
// Move items from profileDir → ~/.claude (destructive — items leave profileDir)
export const moveItemsToClaude = (profileDir) => {
  const sourcePath = join(profileDir, SOURCE_FILE);
  if (!existsSync(sourcePath)) return {};
  const sourceMap = JSON.parse(readFileSync(sourcePath, 'utf-8'));

  for (const [item] of Object.entries(sourceMap)) {
    if (!MANAGED_ITEMS.includes(item)) continue;
    const src = join(profileDir, item);
    const dest = join(CLAUDE_DIR, item);
    if (!existsSync(src)) continue;
    try {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      moveItem(src, dest);
    } catch { /* skip */ }
  }
  return sourceMap;
};
```

### 5. Update use.js to use move functions

```js
import { moveItemsToProfile, moveItemsToClaude, removeItems } from '../item-manager.js';

// In withLock:
// Save current → moveItemsToProfile (items leave ~/.claude)
moveItemsToProfile(activeDir);
// removeItems() is safety net only (items already moved)
removeItems();
// Restore target → moveItemsToClaude (items leave profileDir)
moveItemsToClaude(profileDir);
```

### 6. Apply same pattern to file-operations.js for COPY_DIRS

```js
// Move dirs (for use command)
export const moveDirsToProfile = (profileDir) => { ... renameSync ... };
export const moveDirsToClaude = (profileDir) => { ... renameSync ... };
// Keep saveFiles/restoreFiles as copy-based (for save/create/export)
```

COPY_ITEMS (settings.json, .env, etc.) stay as copy always — tiny files, not worth move complexity.

### 7. Add getEffectiveDir to profile-store.js

```js
// Returns the directory containing a profile's actual files.
// If profile is active, items are in CLAUDE_DIR (moved there during switch).
// If profile is not active, items are in profileDir.
export const getEffectiveDir = (name) => {
  const active = getActive();
  if (active === name) return CLAUDE_DIR;
  return getProfileDir(name);
};
```

### 8. Fix diff.js — use getEffectiveDir

```js
import { getEffectiveDir } from '../profile-store.js';

// Replace:
const dirA = getProfileDir(nameA);
const dirB = getProfileDir(nameB);

// With:
const dirA = getEffectiveDir(nameA);
const dirB = getEffectiveDir(nameB);
```

**Note:** When diffing active profile, reads from ~/.claude which includes NEVER_CLONE items. Need to filter readdirSync output against ALL_MANAGED + COPY_ITEMS + COPY_DIRS to only compare managed items.

### 9. Fix export.js — handle active profile

```js
import { getActive } from '../profile-store.js';
import { saveItems } from '../item-manager.js';
import { saveFiles } from '../file-operations.js';

export const exportCommand = (name, options) => {
  // If exporting active profile, save first (copy, not move)
  const active = getActive();
  if (active === name) {
    const profileDir = getProfileDir(name);
    saveItems(profileDir);  // copyItems — non-destructive
    saveFiles(profileDir);
    info('Saved current state before export.');
  }
  // ... existing tar logic ...
};
```

### 10. Simplify safety.js createBackup

Only backup COPY_ITEMS (not MANAGED_ITEMS — they're in profileDir via move):
```js
export const createBackup = () => {
  // ... timestamp, backupPath ...
  for (const item of COPY_ITEMS) {
    const src = join(CLAUDE_DIR, item);
    if (existsSync(src)) cpSync(src, join(backupPath, item));
  }
  // Skip MANAGED_ITEMS and COPY_DIRS — in profile dir
  // ... prune ...
};
```

## Edge Cases

1. **Interrupted mid-rename:** Item in neither location. Mitigation: one item at a time. Recovery: check both locations.
2. **Permission error (file locked):** renameSync fails → EXDEV fallback also fails → throw. User must close app locking file.
3. **Cross-device (EXDEV):** Auto fallback to filtered copy.
4. **Active profile export:** Auto-save (copy) before tar.
5. **Active profile diff:** Read from ~/.claude via getEffectiveDir.
6. **`csp save` on active profile:** Uses copyItems (non-destructive). ~/.claude unchanged.

## Success Criteria

- `csp use <profile>` < 1s on Windows (was 10-27s)
- `csp save` keeps ~/.claude intact (copy, not move)
- `csp diff current X` works correctly (reads ~/.claude for active)
- `csp export active-profile` includes all files
- All existing tests pass
- Cross-device fallback works

## Risk Assessment

- **Medium:** rename removes source — crash during switch = data loss. Mitigated by one-at-a-time + backup.
- **Low:** Two code paths (copy vs move) — more surface area. Mitigated by shared moveItem helper.
- **Low:** getEffectiveDir adds indirection. Simple conditional.
