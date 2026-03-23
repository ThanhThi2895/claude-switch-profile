import { mkdirSync, cpSync, existsSync, statSync, writeFileSync, copyFileSync, readdirSync, lstatSync, readlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { addProfile, getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveFiles, updateSettingsPaths } from '../file-operations.js';
import { CLAUDE_DIR, SYMLINK_ITEMS, SYMLINK_DIRS, SOURCE_FILE, NEVER_CLONE } from '../constants.js';
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
    // Create new profile — full clone of ~/.claude/ (blacklist approach)
    mkdirSync(profileDir, { recursive: true });

    const sourceMap = {};
    let entries;
    try {
      entries = readdirSync(CLAUDE_DIR);
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (NEVER_CLONE.includes(entry)) continue;

      const src = join(CLAUDE_DIR, entry);
      try {
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
          // Only record in sourceMap if it's a symlink-managed item
          if (SYMLINK_ITEMS.includes(entry)) {
            sourceMap[entry] = dest;
          }
        }
      } catch { /* skip unreadable items */ }
    }

    // Ensure empty dirs for any missing SYMLINK_DIRS
    for (const item of SYMLINK_DIRS) {
      if (!sourceMap[item]) {
        const itemDir = join(profileDir, item);
        mkdirSync(itemDir, { recursive: true });
        sourceMap[item] = itemDir;
      }
    }

    writeFileSync(join(profileDir, SOURCE_FILE), JSON.stringify(sourceMap, null, 2) + '\n');

    // Update absolute paths in settings.json
    updateSettingsPaths(profileDir, 'save');

    info('Created new profile (full clone of current state)');
  }

  addProfile(name, { description: options.description || '' });

  // Set as active if first profile
  if (!getActive()) {
    setActive(name);
    info(`Set "${name}" as active profile`);
  }

  success(`Profile "${name}" created at ${profileDir}`);
};

