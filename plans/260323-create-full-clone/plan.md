# Create Full Clone — Implementation Plan

## Goal

Refactor `csp create <name>` (default case) to produce a **complete, functional clone** of `~/.claude/`, excluding only runtime/cache/tracking data. Fix missing `saveFiles()` call, preserve original symlink targets, add missing items to managed lists, and auto-update `settings.json` paths.

## Proposed Changes

### Constants Layer

#### [MODIFY] [constants.js](file:///d:/WORKSPACES/AI/claude-switch-profile/src/constants.js)

Replace the current whitelist categories with a **blacklist** approach for cloning:

```javascript
// NEW: Items to NEVER clone (runtime/cache/tracking)
export const NEVER_CLONE = [
  '.credentials.json',
  'projects',
  'sessions',
  'session-env',
  'ide',
  'cache',
  'paste-cache',
  'downloads',
  'stats-cache.json',
  'active-plan',
  'history.jsonl',
  'metadata.json',
  'telemetry',
  'debug',
  'statsig',
  'backups',
  'command-archive',
  'commands-archived',
  'todos',
  'tasks',
  'teams',
  'agent-memory',
  'plans',
  'file-history',
  'shell-snapshots',
];
```

Add missing items to existing managed lists so `use`/`save`/`restore` handles them:

```diff
 SYMLINK_ITEMS: add 'statusline.sh', 'statusline.ps1'
 COPY_ITEMS: add '.mcp.json', '.mcp.json.example', '.env.example', '.gitignore'
 COPY_DIRS: add 'workflows', 'scripts', 'output-styles', 'schemas'
```

> [!IMPORTANT]
> Adding items to `SYMLINK_ITEMS`/`COPY_ITEMS`/`COPY_DIRS` also affects `use`, `save`, `restore`, `removeSymlinks`, `removeFiles`. This is **intentional** — these items should be managed during switch too.

Update `NEVER_TOUCH` to match `NEVER_CLONE` (add missing items: `sessions`, `statsig`, `command-archive`, `commands-archived`, `stats-cache.json`, `active-plan`, `metadata.json`, `downloads`).

---

### Create Command

#### [MODIFY] [create.js](file:///d:/WORKSPACES/AI/claude-switch-profile/src/commands/create.js)

Refactor the **default case** (lines 70-112):

**Current behavior:**
1. Copy SYMLINK_ITEMS with `dereference: true` → loses original symlink targets
2. Source.json points to profileDir (self-referencing)
3. No `saveFiles()` call → missing .env, settings.json, etc.
4. Only copies hooks config from settings.json

**New behavior:**
1. Scan `~/.claude/` directory entries
2. For each entry NOT in `NEVER_CLONE`:
   - **If symlink** → record original target in `source.json` via `readlinkSync` (preserve pointer)
   - **If real dir** → `cpSync` to profileDir, record profileDir path in `source.json`
   - **If real file** → `copyFileSync` to profileDir
3. Call `saveFiles(profileDir)` to copy all COPY_ITEMS + COPY_DIRS
4. Call `updateSettingsPaths(profileDir)` to fix absolute paths in settings.json

```javascript
// Pseudocode for new default case
const entries = readdirSync(CLAUDE_DIR);
const sourceMap = {};

for (const entry of entries) {
  if (NEVER_CLONE.includes(entry)) continue;
  
  const src = join(CLAUDE_DIR, entry);
  const stat = lstatSync(src);
  
  if (stat.isSymbolicLink()) {
    // Preserve original symlink target
    sourceMap[entry] = resolve(CLAUDE_DIR, readlinkSync(src));
  } else if (stat.isDirectory()) {
    const dest = join(profileDir, entry);
    cpSync(src, dest, { recursive: true });
    sourceMap[entry] = dest;
  } else if (stat.isFile()) {
    const dest = join(profileDir, entry);
    copyFileSync(src, dest);
    // Only add to sourceMap if it's a SYMLINK_ITEMS candidate
  }
}

writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
saveFiles(profileDir);
updateSettingsPaths(profileDir);
```

---

### Settings Path Update

#### [MODIFY] [file-operations.js](file:///d:/WORKSPACES/AI/claude-switch-profile/src/file-operations.js)

Add new function `updateSettingsPaths(profileDir)`:

```javascript
export const updateSettingsPaths = (profileDir) => {
  const settingsPath = join(profileDir, 'settings.json');
  if (!existsSync(settingsPath)) return;
  
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    let changed = false;
    
    // Update hooks paths: replace ~/.claude/ references with profileDir
    if (settings.hooks) {
      const json = JSON.stringify(settings.hooks);
      const updated = json.replaceAll(CLAUDE_DIR, profileDir);
      if (updated !== json) {
        settings.hooks = JSON.parse(updated);
        changed = true;
      }
    }
    
    if (changed) {
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    }
  } catch { /* parse error — skip */ }
};
```

> [!WARNING]
> `String.replaceAll` trên paths cần handle cả forward/backslash trên Windows. Cần normalize paths trước khi replace.

---

## Files Changed Summary

| File | Change | Risk |
|------|--------|------|
| `constants.js` | Add `NEVER_CLONE`, expand `SYMLINK_ITEMS`, `COPY_ITEMS`, `COPY_DIRS`, `NEVER_TOUCH` | Medium — affects use/save/restore flow |
| `create.js` | Refactor default case: scan+blacklist, preserve symlinks, call saveFiles | High — core logic change |
| `file-operations.js` | Add `updateSettingsPaths()` | Low — additive |

## Verification Plan

### Automated Tests
```bash
npm test          # Existing tests still pass
```

### Manual Verification
1. `csp create test-clone` → verify all items from `~/.claude/` present in profile dir (except NEVER_CLONE)
2. Check `source.json` → symlink items should have original targets, not profileDir self-refs
3. Check `settings.json` in profile dir → hooks paths updated
4. `csp use test-clone` + `csp use default` → verify switch works correctly with new items
5. Verify `.mcp.json`, `workflows/`, `scripts/`, `output-styles/` all restored on switch

---

*Status: complete*
