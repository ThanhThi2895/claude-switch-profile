import { getPrevious, getActive, profileExists } from '../profile-store.js';
import { launchCommand } from './launch.js';
import { error, info } from '../output-helpers.js';

export const toggleCommand = async () => {
  const previous = getPrevious();
  const active = getActive();

  if (!previous) {
    error('No previous profile to toggle to. Switch profiles first.');
    process.exit(1);
  }

  if (previous === active) {
    info(`Already on "${active}" — no previous profile to toggle to.`);
    return;
  }

  if (!profileExists(previous)) {
    error(`Previous profile "${previous}" no longer exists.`);
    process.exit(1);
  }

  await launchCommand(previous, [], {});
};
