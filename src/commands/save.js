import { getActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveItems } from '../item-manager.js';
import { saveFiles, updateSettingsPaths } from '../file-operations.js';
import { success, error, info } from '../output-helpers.js';
import { DEFAULT_PROFILE } from '../constants.js';

export const saveCommand = () => {
  const active = getActive();
  if (!active) {
    error('No active profile. Run "csp create <name>" first.');
    process.exit(1);
  }

  if (active === DEFAULT_PROFILE) {
    info('Default profile uses ~/.claude directly. No save needed.');
    return;
  }

  if (!profileExists(active)) {
    error(`Active profile "${active}" directory is missing.`);
    process.exit(1);
  }

  const profileDir = getProfileDir(active);
  saveItems(profileDir);
  saveFiles(profileDir);
  updateSettingsPaths(profileDir, 'save');
  success(`Saved current state to profile "${active}"`);
};
