import { mkdirSync, cpSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { addProfile, getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveFiles } from '../file-operations.js';
import { CLAUDE_DIR, MANAGED_ITEMS, MANAGED_DIRS, SOURCE_FILE } from '../constants.js';
import { success, error, info, warn } from '../output-helpers.js';

export const createCommand = (name, options) => {
  if (profileExists(name)) {
    error(`Profile "${name}" already exists.`);
    process.exit(1);
  }

  const profileDir = getProfileDir(name);

  if (options.from) {
    // Clone from existing profile
    if (!profileExists(options.from)) {
      error(`Source profile "${options.from}" does not exist.`);
      process.exit(1);
    }
    const sourceDir = getProfileDir(options.from);
    cpSync(sourceDir, profileDir, { recursive: true, verbatimSymlinks: true });
    info(`Cloned from profile "${options.from}"`);
  } else if (options.source) {
    // Create from a specific .agents/ directory (or any kit directory)
    const sourcePath = resolve(options.source);
    if (!existsSync(sourcePath)) {
      error(`Source directory "${options.source}" does not exist.`);
      process.exit(1);
    }

    mkdirSync(profileDir, { recursive: true });

    // Copy items from source kit into profile dir
    const sourceMap = {};
    for (const item of MANAGED_ITEMS) {
      const target = join(sourcePath, item);
      if (existsSync(target)) {
        const dest = join(profileDir, item);
        try {
          cpSync(target, dest, { recursive: true, verbatimSymlinks: true });
          sourceMap[item] = dest;
        } catch { /* skip */ }
      }
    }

    if (Object.keys(sourceMap).length === 0) {
      warn(`No recognized items found in "${sourcePath}". Expected: ${MANAGED_ITEMS.join(', ')}`);
    }

    // Inherit missing items from current ~/.claude state
    for (const item of MANAGED_ITEMS) {
      if (sourceMap[item]) continue;
      const src = join(CLAUDE_DIR, item);
      if (!existsSync(src)) continue;
      try {
        const dest = join(profileDir, item);
        cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
        sourceMap[item] = dest;
      } catch { /* skip */ }
    }

    writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
    info(`Copied from kit at ${sourcePath}`);
    info(`Items found: ${Object.keys(sourceMap).join(', ') || 'none'}`);

    // Also copy current mutable files
    saveFiles(profileDir);
  } else {
    // Create new profile — empty by default
    mkdirSync(profileDir, { recursive: true });

    const sourceMap = {};

    // Ensure empty dirs for MANAGED_DIRS
    for (const item of MANAGED_DIRS) {
      const itemDir = join(profileDir, item);
      mkdirSync(itemDir, { recursive: true });
      sourceMap[item] = itemDir;
    }

    writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');

    info('Created new profile (empty by default)');
  }

  addProfile(name, { description: options.description || '', mode: 'account-session' });

  // Set as active if first profile
  if (!getActive()) {
    setActive(name);
    info(`Set "${name}" as active profile`);
  }

  success(`Profile "${name}" created at ${profileDir}`);
};
