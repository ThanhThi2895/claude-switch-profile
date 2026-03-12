import { existsSync, mkdirSync, writeFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { ensureProfilesDir, getActive, addProfile, setActive, getProfileDir } from '../profile-store.js';
import { success, info, warn } from '../output-helpers.js';
import { PROFILES_DIR, SOURCE_FILE, CLAUDE_DIR, SYMLINK_ITEMS } from '../constants.js';

export const initCommand = () => {
  if (existsSync(PROFILES_DIR) && getActive()) {
    const active = getActive();
    info(`Already initialized. Active profile: "${active}"`);
    info(`Profiles directory: ${PROFILES_DIR}`);
    return;
  }

  ensureProfilesDir();
  info('Initializing Claude Switch Profile...');

  // Create "default" as vanilla Claude — empty profile with no symlinks or copy files.
  // Switching to this profile removes all managed items, restoring Claude's built-in defaults.
  const profileDir = getProfileDir('default');
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(join(profileDir, SOURCE_FILE), '{}\n');

  addProfile('default', { description: 'Vanilla Claude defaults' });
  setActive('default');

  success('Initialization complete. "default" profile uses vanilla Claude defaults.');

  // Warn if real directories exist that should be captured into a profile
  const realItems = SYMLINK_ITEMS.filter((item) => {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      const stat = lstatSync(itemPath);
      return !stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile());
    } catch {
      return false;
    }
  });

  if (realItems.length) {
    warn(`Real directories/files detected: ${realItems.join(', ')}`);
    info('Run "csp create <name>" to capture them into a profile.');
  }
};
