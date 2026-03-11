import { mkdirSync, cpSync, existsSync } from 'node:fs';
import { addProfile, getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveSymlinks } from '../symlink-manager.js';
import { saveFiles } from '../file-operations.js';
import { success, error, info } from '../output-helpers.js';

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
