import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_FILE, MANAGED_ITEMS } from './constants.js';

// Validate a profile directory
export const validateProfile = (profileDir) => {
  const errors = [];

  if (!existsSync(profileDir)) {
    return { valid: false, errors: ['Profile directory does not exist'] };
  }

  const sourcePath = join(profileDir, SOURCE_FILE);
  if (!existsSync(sourcePath)) {
    errors.push('Missing source.json — no managed items defined');
  }

  return { valid: errors.length === 0, errors };
};

// Check all item targets in sourceMap actually exist on disk
export const validateSourceTargets = (sourceMap) => {
  const errors = [];
  for (const [item, target] of Object.entries(sourceMap)) {
    if (!existsSync(target)) {
      errors.push(`${item}: target does not exist → ${target}`);
    }
  }
  return { valid: errors.length === 0, errors };
};

// List what files a profile contains
export const listManagedItems = (profileDir) => {
  if (!existsSync(profileDir)) return { files: [], dirs: [] };

  const entries = readdirSync(profileDir, { withFileTypes: true });
  const items = { files: [], dirs: [] };

  for (const entry of entries) {
    if (entry.isDirectory()) {
      items.dirs.push(entry.name);
    } else {
      items.files.push(entry.name);
    }
  }

  return items;
};
