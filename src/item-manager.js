import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, mkdirSync, lstatSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
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

// Copy managed items from ~/.claude into profileDir, write source.json manifest
export const saveItems = (profileDir) => {
  const sourceMap = {};
  for (const item of MANAGED_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (!existsSync(itemPath)) continue;

      const dest = join(profileDir, item);
      const stat = lstatSync(itemPath);

      if (stat.isDirectory()) {
        rmSync(dest, { recursive: true, force: true });
        cpSync(itemPath, dest, { recursive: true });
      } else if (stat.isFile()) {
        copyFileSync(itemPath, dest);
      }
      sourceMap[item] = dest;
    } catch {
      // Not readable — skip
    }
  }
  writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
  return sourceMap;
};

// Read source.json from profileDir and copy items into ~/.claude
export const restoreItems = (profileDir) => {
  const sourcePath = join(profileDir, SOURCE_FILE);
  if (!existsSync(sourcePath)) return {};

  const sourceMap = JSON.parse(readFileSync(sourcePath, 'utf-8'));

  for (const [item, srcPath] of Object.entries(sourceMap)) {
    if (!MANAGED_ITEMS.includes(item)) continue;

    const dest = join(CLAUDE_DIR, item);

    // Remove existing item in ~/.claude
    try {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    } catch {
      // fine
    }

    // Copy from profile (or external legacy path) into ~/.claude
    if (existsSync(srcPath)) {
      try {
        const stat = lstatSync(srcPath);
        if (stat.isDirectory()) {
          cpSync(srcPath, dest, { recursive: true });
        } else if (stat.isFile()) {
          copyFileSync(srcPath, dest);
        }
      } catch {
        // skip unreadable
      }
    }
  }

  return sourceMap;
};
