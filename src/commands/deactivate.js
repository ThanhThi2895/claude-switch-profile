import { getActive, setActive } from '../profile-store.js';
import { success, info } from '../output-helpers.js';
import { DEFAULT_PROFILE } from '../constants.js';

export const deactivateCommand = async () => {
  const active = getActive();
  if (!active) {
    info('No active profile to deactivate.');
    return;
  }

  if (active === DEFAULT_PROFILE) {
    info('Default profile uses ~/.claude directly. Nothing to deactivate.');
    return;
  }

  // Just reset to default — never touch ~/.claude
  setActive(DEFAULT_PROFILE);

  success(`Profile "${active}" deactivated. Reset to default.`);
  info('~/.claude was not modified.');
};
