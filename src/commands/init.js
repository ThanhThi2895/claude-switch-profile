import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureProfilesDir, getActive, addProfile, setActive, getProfileDir } from '../profile-store.js';
import { success, info } from '../output-helpers.js';
import { PROFILES_DIR, SOURCE_FILE } from '../constants.js';

export const initCommand = () => {
  if (existsSync(PROFILES_DIR) && getActive()) {
    const active = getActive();
    info(`Already initialized. Active profile: "${active}"`);
    info(`Profiles directory: ${PROFILES_DIR}`);
    return;
  }

  ensureProfilesDir();
  info('Initializing Claude Switch Profile...');

  // Create "default" as vanilla Claude — empty profile with no managed items.
  // Switching to this profile removes all managed items, restoring Claude's built-in defaults.
  const profileDir = getProfileDir('default');
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(join(profileDir, SOURCE_FILE), '{}\n');

  addProfile('default', { description: 'Vanilla Claude defaults' });
  setActive('default');

  success('Initialization complete.');
  info('"default" profile uses ~/.claude directly — no copy/restore needed.');
  info('Run "csp create <name>" to capture your current setup into a new profile.');
};
