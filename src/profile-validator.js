import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_FILE, SYMLINK_ITEMS } from './constants.js';

// Validate a profile directory
export const validateProfile = (profileDir) => {
  const errors = [];

  if (!existsSync(profileDir)) {
    return { valid: false, errors: ['Profile directory does not exist'] };
  }

  const sourcePath = join(profileDir, SOURCE_FILE);
  if (!existsSync(sourcePath)) {
    errors.push('Missing source.json — no symlink targets defined');
  }

  return { valid: errors.length === 0, errors };
};

// Check all symlink targets in sourceMap actually exist on disk
export const validateSourceTargets = (sourceMap) => {
  const errors = [];
  for (const [item, target] of Object.entries(sourceMap)) {
    if (!existsSync(target)) {
      errors.push(`${item}: target does not exist → ${target}`);
    }
  }
  return { valid: errors.length === 0, errors };
};

// List what files/symlinks a profile contains
export const listManagedItems = (profileDir) => {
  if (!existsSync(profileDir)) return { symlinks: [], files: [], dirs: [] };

  const entries = readdirSync(profileDir, { withFileTypes: true });
  const items = { symlinks: [], files: [], dirs: [] };

  for (const entry of entries) {
    if (entry.name === SOURCE_FILE) {
      items.files.push(entry.name);
    } else if (entry.isDirectory()) {
      items.dirs.push(entry.name);
    } else {
      items.files.push(entry.name);
    }
  }

  return items;
};
