import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, mkdirSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { CLAUDE_DIR, MANAGED_ITEMS, SOURCE_FILE } from './constants.js';


// Read current managed items from ~/.claude — returns map of {item: claudeDir/item}
export const readCurrentItems = () => {
  const itemMap = {};
  for (const item of MANAGED_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (existsSync(itemPath)) {
        itemMap[item] = itemPath;
      }
    } catch {
      // Item doesn't exist or isn't readable — skip
    }
  }
  return itemMap;
};

// Remove all managed items (dirs/files) from ~/.claude
export const removeItems = () => {
  for (const item of MANAGED_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (existsSync(itemPath)) {
        rmSync(itemPath, { recursive: true, force: true });
      }
    } catch {
      // Already gone — skip
    }
  }
};

const copyItemPreservingSymlink = (src, dest) => {
  mkdirSync(dirname(dest), { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
};

// Copy managed items from ~/.claude into profileDir, write source.json manifest (non-destructive)
export const copyItems = (profileDir) => {
  const sourceMap = {};
  for (const item of MANAGED_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (!existsSync(itemPath)) continue;

      const dest = join(profileDir, item);
      copyItemPreservingSymlink(itemPath, dest);
      sourceMap[item] = dest;
    } catch {
      // Not readable — skip
    }
  }
  writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
  return sourceMap;
};

// Backward-compatible alias for save.js
export const saveItems = copyItems;

// Read source.json from profileDir and copy items into ~/.claude (non-destructive)
export const restoreItems = (profileDir) => {
  const sourcePath = join(profileDir, SOURCE_FILE);
  if (!existsSync(sourcePath)) return {};

  const sourceMap = JSON.parse(readFileSync(sourcePath, 'utf-8'));

  for (const [item, srcPath] of Object.entries(sourceMap)) {
    if (!MANAGED_ITEMS.includes(item)) continue;

    const dest = join(CLAUDE_DIR, item);
    const localSrc = join(profileDir, item);
    const restoreSrc = existsSync(localSrc) ? localSrc : srcPath;

    try {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    } catch {
      // fine
    }

    // Prefer profile-local snapshot; fallback to legacy external source path
    if (restoreSrc && existsSync(restoreSrc)) {
      try {
        copyItemPreservingSymlink(restoreSrc, dest);
      } catch {
        // skip unreadable
      }
    }
  }

  return sourceMap;
};

