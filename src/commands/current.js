import { getActive } from '../profile-store.js';
import { getProfileDir } from '../profile-store.js';
import { success, info, warn } from '../output-helpers.js';

export const currentCommand = () => {
  const active = getActive();
  if (!active) {
    warn('No active profile. Run "csp create <name>" to create one.');
    return;
  }
  success(`Active profile: ${active}`);
  info(`Location: ${getProfileDir(active)}`);
};
