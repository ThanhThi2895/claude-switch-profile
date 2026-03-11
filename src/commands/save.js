import { getActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveSymlinks } from '../symlink-manager.js';
import { saveFiles } from '../file-operations.js';
import { success, error } from '../output-helpers.js';

export const saveCommand = () => {
  const active = getActive();
  if (!active) {
    error('No active profile. Run "csp create <name>" first.');
    process.exit(1);
  }

  if (!profileExists(active)) {
    error(`Active profile "${active}" directory is missing.`);
    process.exit(1);
  }

  const profileDir = getProfileDir(active);
  saveSymlinks(profileDir);
  saveFiles(profileDir);
  success(`Saved current state to profile "${active}"`);
};
