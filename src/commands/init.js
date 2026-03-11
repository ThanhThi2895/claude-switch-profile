import { existsSync } from 'node:fs';
import { ensureProfilesDir, getActive, profileExists } from '../profile-store.js';
import { createCommand } from './create.js';
import { success, info, warn } from '../output-helpers.js';
import { PROFILES_DIR } from '../constants.js';

export const initCommand = () => {
  if (existsSync(PROFILES_DIR) && getActive()) {
    const active = getActive();
    info(`Already initialized. Active profile: "${active}"`);
    info(`Profiles directory: ${PROFILES_DIR}`);
    return;
  }

  ensureProfilesDir();
  info('Initializing Claude Switch Profile...');

  // Create default profile from current state
  createCommand('default', { description: 'Default profile (initial capture)' });
  success('Initialization complete. Your current setup is saved as "default".');
};
