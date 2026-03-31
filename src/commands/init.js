import { existsSync } from 'node:fs';
import {
  ensureProfilesDir,
  ensureDefaultProfileSnapshot,
  getActive,
  readProfiles,
  addProfile,
  setActive,
  getProfileDir,
} from '../profile-store.js';
import { success, info, error } from '../output-helpers.js';
import { PROFILES_DIR, DEFAULT_PROFILE } from '../constants.js';

export const initCommand = () => {
  const active = getActive();

  ensureProfilesDir();
  info('Initializing Claude Switch Profile...');

  const profiles = readProfiles();
  if (!profiles[DEFAULT_PROFILE]) {
    addProfile(DEFAULT_PROFILE, { description: 'Vanilla Claude defaults', mode: 'legacy' });
  }

  try {
    ensureDefaultProfileSnapshot();
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  if (existsSync(PROFILES_DIR) && active) {
    info(`Already initialized. Active profile: "${active}"`);
    info(`Profiles directory: ${PROFILES_DIR}`);
    return;
  }

  setActive(DEFAULT_PROFILE);

  success('Initialization complete.');
  info(`Created physical default profile at ${getProfileDir(DEFAULT_PROFILE)}`);
  info('Run "csp create <name>" to capture your current setup into a new profile.');
};
