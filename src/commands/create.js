import { mkdirSync, cpSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { addProfile, getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveSymlinks } from '../symlink-manager.js';
import { saveFiles } from '../file-operations.js';
import { SYMLINK_ITEMS, SOURCE_FILE } from '../constants.js';
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
    cpSync(sourceDir, profileDir, { recursive: true });
    info(`Cloned from profile "${options.from}"`);
  } else if (options.source) {
    // Create from a specific .agents/ directory (or any kit directory)
    const sourcePath = resolve(options.source);
    if (!existsSync(sourcePath)) {
      error(`Source directory "${options.source}" does not exist.`);
      process.exit(1);
    }

    mkdirSync(profileDir, { recursive: true });

    // Build source.json from the kit directory
    const sourceMap = {};
    for (const item of SYMLINK_ITEMS) {
      const target = join(sourcePath, item);
      if (existsSync(target)) {
        sourceMap[item] = target;
      }
    }

    if (Object.keys(sourceMap).length === 0) {
      warn(`No recognized items found in "${sourcePath}". Expected: ${SYMLINK_ITEMS.join(', ')}`);
    }

    writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
    info(`Linked to kit at ${sourcePath}`);
    info(`Items found: ${Object.keys(sourceMap).join(', ') || 'none'}`);

    // Also copy current mutable files
    saveFiles(profileDir);
  } else {
    // Create from current ~/.claude state
    mkdirSync(profileDir, { recursive: true });
    saveSymlinks(profileDir);
    saveFiles(profileDir);
    info('Captured current Claude Code configuration');
  }

  addProfile(name, { description: options.description || '' });

  // Set as active if first profile
  if (!getActive()) {
    setActive(name);
    info(`Set "${name}" as active profile`);
  }

  success(`Profile "${name}" created at ${profileDir}`);
};
