import { existsSync, readlinkSync, symlinkSync, unlinkSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CLAUDE_DIR, SYMLINK_ITEMS, SOURCE_FILE } from './constants.js';

// Read current symlink targets from ~/.claude for all SYMLINK_ITEMS
export const readCurrentSymlinks = () => {
  const sourceMap = {};
  for (const item of SYMLINK_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (existsSync(itemPath) && lstatSync(itemPath).isSymbolicLink()) {
        sourceMap[item] = resolve(CLAUDE_DIR, readlinkSync(itemPath));
      }
    } catch {
      // Item doesn't exist or isn't readable — skip
    }
  }
  return sourceMap;
};

// Remove all managed symlinks from ~/.claude
export const removeSymlinks = () => {
  for (const item of SYMLINK_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (existsSync(itemPath) && lstatSync(itemPath).isSymbolicLink()) {
        unlinkSync(itemPath);
      }
    } catch {
      // Already gone or not a symlink — skip
    }
  }
};

// Create symlinks in ~/.claude from a sourceMap object
export const createSymlinks = (sourceMap) => {
  for (const [item, target] of Object.entries(sourceMap)) {
    if (!SYMLINK_ITEMS.includes(item)) continue;
    const itemPath = join(CLAUDE_DIR, item);

    // Remove existing if present
    try {
      if (lstatSync(itemPath)) unlinkSync(itemPath);
    } catch {
      // Doesn't exist — fine
    }

    // Only create if target exists
    if (existsSync(target)) {
      symlinkSync(target, itemPath);
    }
  }
};

// Save current symlink targets to profileDir/source.json
export const saveSymlinks = (profileDir) => {
  const sourceMap = readCurrentSymlinks();
  writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
  return sourceMap;
};

// Read source.json from profileDir and create symlinks
export const restoreSymlinks = (profileDir) => {
  const sourcePath = join(profileDir, SOURCE_FILE);
  if (!existsSync(sourcePath)) return {};
  const sourceMap = JSON.parse(readFileSync(sourcePath, 'utf-8'));
  createSymlinks(sourceMap);
  return sourceMap;
};
