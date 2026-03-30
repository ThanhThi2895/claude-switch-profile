import { existsSync } from 'node:fs';
import { ensureProfilesDir, getActive, addProfile, setActive } from '../profile-store.js';
import { success, info } from '../output-helpers.js';
import { PROFILES_DIR } from '../constants.js';

export const initCommand = () => {
  const active = getActive();
  if (existsSync(PROFILES_DIR) && active) {
    info(`Already initialized. Active profile: "${active}"`);
    info(`Profiles directory: ${PROFILES_DIR}`);
    return;
  }

  ensureProfilesDir();
  info('Initializing Claude Switch Profile...');

  addProfile('default', { description: 'Vanilla Claude defaults', mode: 'legacy' });
  setActive('default');

  success('Initialization complete.');
  info('"default" profile uses ~/.claude directly — no copy/restore needed.');
  info('Run "csp create <name>" to capture your current setup into a new profile.');
};
