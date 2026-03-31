import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, mkdirSync, lstatSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { CLAUDE_DIR, MANAGED_ITEMS, SOURCE_FILE } from './constants.js';

const SKIP_PATTERNS = ['.venv', 'node_modules', '__pycache__', '.git'];
const skipHeavyDirs = (src) => !SKIP_PATTERNS.includes(basename(src));

// Rename-based move with EXDEV fallback (filtered copy + delete)
const moveItem = (src, dest) => {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  try {
    renameSync(src, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      cpSync(src, dest, { recursive: true, filter: skipHeavyDirs, verbatimSymlinks: true });
      rmSync(src, { recursive: true, force: true });
    } else throw err;
  }
};

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

    try {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    } catch {
      // fine
    }

    // Copy from profile (or external legacy path) into ~/.claude
    if (existsSync(srcPath)) {
      try {
        copyItemPreservingSymlink(srcPath, dest);
      } catch {
        // skip unreadable
      }
    }
  }

  return sourceMap;
};

// Move items from ~/.claude → profileDir (destructive — items leave ~/.claude)
export const moveItemsToProfile = (profileDir) => {
  mkdirSync(profileDir, { recursive: true });
  const sourceMap = {};
  for (const item of MANAGED_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    if (!existsSync(itemPath)) continue;
    try {
      const dest = join(profileDir, item);
      moveItem(itemPath, dest);
      sourceMap[item] = dest;
    } catch {
      // skip
    }
  }
  writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
  return sourceMap;
};

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
    } catch {
      // skip
    }
  }
  return sourceMap;
};
