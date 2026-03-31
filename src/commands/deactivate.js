import { getActive } from '../profile-store.js';
import { success, info } from '../output-helpers.js';
import { DEFAULT_PROFILE } from '../constants.js';
import { useCommand } from './use.js';

export const deactivateCommand = async (options = {}) => {
  const active = getActive();
  if (!active) {
    info('No active profile to deactivate.');
    return;
  }

  if (active === DEFAULT_PROFILE) {
    info('Default profile is already active.');
    return;
  }

  await useCommand(DEFAULT_PROFILE, options);
  success(`Profile "${active}" deactivated.`);
};
