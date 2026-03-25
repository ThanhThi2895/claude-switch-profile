# Phase 2: Default Profile Pass-Through

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 1h (revised from 45m — deactivate + uninstall updates)

Make "default" profile a direct mapping to ~/.claude. No save/restore when switching to/from default.

## Related Code Files

- **Modify:** `src/commands/use.js` — skip save when from=default, skip restore when to=default
- **Modify:** `src/commands/save.js` — no-op when active=default
- **Modify:** `src/commands/init.js` — update init message
- **Modify:** `src/commands/deactivate.js` — no-op when active=default
- **Modify:** `src/commands/delete.js` — block deleting default profile
- **Modify:** `src/commands/uninstall.js` — skip restore when restoring default (items already in ~/.claude)
- **Modify:** `src/commands/diff.js` — handle default profile in getEffectiveDir (always returns CLAUDE_DIR)
- **Modify:** `src/commands/export.js` — handle default profile (save copy before tar)
- **Modify:** `src/constants.js` — add DEFAULT_PROFILE constant
- **Keep:** `src/commands/create.js` — no special handling needed

## Implementation Steps

### 1. Add constant in constants.js

```js
export const DEFAULT_PROFILE = 'default';
```

### 2. Update use.js switch flow

```js
import { DEFAULT_PROFILE } from '../constants.js';
import { moveItemsToProfile, moveItemsToClaude, removeItems } from '../item-manager.js';

await withLock(async () => {
  // 1. Save current state (skip if from=default — ~/.claude IS default)
  if (active && active !== DEFAULT_PROFILE && profileExists(active) && options.save !== false) {
    const activeDir = getProfileDir(active);
    moveItemsToProfile(activeDir);     // move items out of ~/.claude
    saveFiles(activeDir);
    updateSettingsPaths(activeDir, 'save');
    info(`Saved current state to "${active}"`);
  }

  // 2. Remove leftovers (safety net after move + remove COPY_ITEMS)
  if (active !== DEFAULT_PROFILE) {
    removeItems();
  }
  removeFiles();

  // 3. Restore target (skip if to=default — ~/.claude already correct)
  if (name !== DEFAULT_PROFILE) {
    try {
      moveItemsToClaude(profileDir);
      restoreFiles(profileDir);
      updateSettingsPaths(CLAUDE_DIR, 'restore', profileDir);
    } catch (err) {
      warn(`Switch failed: ${err.message}`);
      throw err;
    }
  }

  // 4. Update active marker
  setActive(name);
  success(`Switched to profile "${name}"`);
  if (name === DEFAULT_PROFILE) {
    info('Using ~/.claude directly (default profile).');
  } else {
    info('Restart your Claude Code session to apply changes.');
  }
});
```

### 3. Update save.js — no-op for default

```js
import { DEFAULT_PROFILE } from '../constants.js';

export const saveCommand = () => {
  const active = getActive();
  if (!active) { error('No active profile.'); process.exit(1); }

  if (active === DEFAULT_PROFILE) {
    info('Default profile uses ~/.claude directly. No save needed.');
    return;
  }

  // ... existing save logic (copyItems, not moveItems) ...
};
```

### 4. Update deactivate.js — no-op for default

```js
import { DEFAULT_PROFILE } from '../constants.js';

export const deactivateCommand = async (options) => {
  const active = getActive();
  if (!active) { info('No active profile.'); return; }

  if (active === DEFAULT_PROFILE) {
    info('Default profile uses ~/.claude directly. Nothing to deactivate.');
    return;
  }

  // ... existing deactivate logic ...
};
```

### 5. Update delete.js — block deleting default

```js
import { DEFAULT_PROFILE } from '../constants.js';

export const deleteCommand = async (name, options) => {
  if (name === DEFAULT_PROFILE) {
    error('Cannot delete the default profile.');
    process.exit(1);
  }
  // ... existing logic ...
};
```

### 6. Update uninstall.js — handle default restore

```js
import { DEFAULT_PROFILE } from '../constants.js';

// Inside withLock:
const restoreProfile = options.profile || active;

removeItems();
removeFiles();

// If restoring default or active profile, items already in ~/.claude
if (restoreProfile && restoreProfile !== DEFAULT_PROFILE && profileExists(restoreProfile)) {
  const profileDir = getProfileDir(restoreProfile);
  // If restoring the active profile: items already in ~/.claude (moved there on switch)
  // If restoring a different profile: need to restore from profileDir
  if (restoreProfile !== active) {
    restoreItems(profileDir);  // copy-based, since we're about to delete everything
    restoreFiles(profileDir);
  }
  success(`Restored "${restoreProfile}" profile to ~/.claude`);
} else if (restoreProfile === DEFAULT_PROFILE) {
  info('Default profile — ~/.claude already in correct state.');
} else {
  warn('No profile restored.');
}
```

### 7. Update getEffectiveDir for default

```js
export const getEffectiveDir = (name) => {
  if (name === DEFAULT_PROFILE) return CLAUDE_DIR;  // default always = ~/.claude
  const active = getActive();
  if (active === name) return CLAUDE_DIR;            // active profile items in ~/.claude
  return getProfileDir(name);
};
```

### 8. Update init.js messaging

```js
success('Initialization complete.');
info('"default" profile uses ~/.claude directly — no copy/restore needed.');
info('Run "csp create <name>" to capture your current setup into a new profile.');
```

## Flow Diagrams

```
FROM default → TO work:
  skip save (default = ~/.claude, nothing to save)
  removeFiles()
  moveItemsToClaude(work/)     # move work items to ~/.claude
  restoreFiles(work/)
  active = work

FROM work → TO default:
  moveItemsToProfile(work/)    # move items back to work/
  saveFiles(work/)
  removeItems() (safety)
  removeFiles()
  skip restore (default = ~/.claude already)
  active = default

FROM work → TO personal:
  moveItemsToProfile(work/)    # move items to work/
  saveFiles(work/)
  removeItems() (safety)
  removeFiles()
  moveItemsToClaude(personal/) # move personal items to ~/.claude
  restoreFiles(personal/)
  active = personal
```

## Success Criteria

- `csp use default` from any profile: saves current, sets active=default. No restore.
- `csp use X` from default: skips save, restores X.
- `csp save` while default: info message, no-op.
- `csp deactivate` while default: info message, no-op.
- `csp delete default`: blocked with error.
- `csp export default`: saves copy first, then tars.
- `csp diff current X` while default: reads from ~/.claude.
- `csp uninstall` while default: skips restore (already correct).

## Risk Assessment

- **Low:** "default" = magic name. Mitigated by clear messaging.
- **Low:** Existing default profile data in profileDir becomes stale. Acceptable — data was only source.json = {}.
