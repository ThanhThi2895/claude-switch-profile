import { getActive, getProfileDir, getProfileMeta, ensureDefaultProfileSnapshot } from '../profile-store.js';
import { DEFAULT_PROFILE } from '../constants.js';
import { success, info, warn, error } from '../output-helpers.js';

export const currentCommand = () => {
  const active = getActive();
  if (!active) {
    warn('No active profile. Run "csp create <name>" to create one.');
    return;
  }

  if (active === DEFAULT_PROFILE) {
    try {
      ensureDefaultProfileSnapshot();
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  }

  success(`Active legacy profile: ${active}`);
  info(`Location: ${getProfileDir(active)}`);

  const meta = getProfileMeta(active);
  if (meta?.lastLaunchAt) {
    info(`Last isolated launch: ${meta.lastLaunchAt}`);
    if (meta.runtimeDir) info(`Isolated runtime: ${meta.runtimeDir}`);
  }
};
