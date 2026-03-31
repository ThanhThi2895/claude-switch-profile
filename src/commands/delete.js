import { rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { getActive, clearActive, removeProfile, profileExists, getProfileDir } from '../profile-store.js';
import { success, error, warn, info } from '../output-helpers.js';
import { DEFAULT_PROFILE } from '../constants.js';

const confirm = (question) => {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
};

export const deleteCommand = async (name, options) => {
  if (name === DEFAULT_PROFILE) {
    error('Cannot delete the default profile.');
    process.exit(1);
  }

  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  if (!options.force) {
    const confirmed = await confirm(`Delete profile "${name}"? This cannot be undone. (y/N) `);
    if (!confirmed) {
      warn('Cancelled.');
      return;
    }
  }

  const active = getActive();
  const profileDir = getProfileDir(name);

  // Delete profile directory
  rmSync(profileDir, { recursive: true, force: true });
  removeProfile(name);

  // If deleting the active profile, just clear the marker
  // NEVER touch ~/.claude — leave symlinks/files as-is
  if (active === name) {
    clearActive();
    info('Was active profile — active marker cleared.');
    info('Symlinks in ~/.claude may now be dangling. Run "csp use <profile>" to switch.');
  }

  success(`Profile "${name}" deleted.`);
};
