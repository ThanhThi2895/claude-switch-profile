import { mkdirSync, cpSync, existsSync, statSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { addProfile, getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveFiles } from '../file-operations.js';
import { CLAUDE_DIR, SYMLINK_ITEMS, SYMLINK_DIRS, SOURCE_FILE } from '../constants.js';
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

    // Inherit missing items from current state (hooks, statusline, etc.)
    for (const item of SYMLINK_ITEMS) {
      if (sourceMap[item]) continue;
      const src = join(CLAUDE_DIR, item);
      if (!existsSync(src)) continue;
      try {
        const dest = join(profileDir, item);
        if (statSync(src).isDirectory()) {
          cpSync(src, dest, { recursive: true, dereference: true });
        } else {
          copyFileSync(src, dest);
        }
        sourceMap[item] = dest;
      } catch { /* skip */ }
    }

    writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');
    info(`Linked to kit at ${sourcePath}`);
    info(`Items found: ${Object.keys(sourceMap).join(', ') || 'none'}`);

    // Also copy current mutable files
    saveFiles(profileDir);
  } else {
    // Create new independent profile — inherit infrastructure from current state
    mkdirSync(profileDir, { recursive: true });

    // Copy all current symlink items (dirs + files) into profile — dereference symlinks
    const sourceMap = {};
    for (const item of SYMLINK_ITEMS) {
      const src = join(CLAUDE_DIR, item);
      const dest = join(profileDir, item);
      try {
        if (!existsSync(src)) continue;
        if (statSync(src).isDirectory()) {
          cpSync(src, dest, { recursive: true, dereference: true });
        } else {
          copyFileSync(src, dest);
        }
        sourceMap[item] = dest;
      } catch { /* skip unreadable items */ }
    }

    // Fallback: ensure empty dirs for any missing SYMLINK_DIRS
    for (const item of SYMLINK_DIRS) {
      if (!sourceMap[item]) {
        const itemDir = join(profileDir, item);
        mkdirSync(itemDir, { recursive: true });
        sourceMap[item] = itemDir;
      }
    }

    writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');

    // Copy hooks config from settings.json (hooks won't run without it)
    const settingsPath = join(CLAUDE_DIR, 'settings.json');
    if (existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        if (settings.hooks) {
          writeFileSync(join(profileDir, 'settings.json'), JSON.stringify({ hooks: settings.hooks }, null, 2) + '\n');
        }
      } catch { /* parse error — skip */ }
    }

    info('Created new independent profile (infrastructure inherited)');
  }

  addProfile(name, { description: options.description || '' });

  // Set as active if first profile
  if (!getActive()) {
    setActive(name);
    info(`Set "${name}" as active profile`);
  }

  success(`Profile "${name}" created at ${profileDir}`);
};
