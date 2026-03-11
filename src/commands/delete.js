import { rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { getActive, removeProfile, profileExists, getProfileDir } from '../profile-store.js';
import { success, error, warn } from '../output-helpers.js';

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
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const active = getActive();
  if (active === name) {
    error(`Cannot delete active profile "${name}". Switch to another profile first.`);
    process.exit(1);
  }

  if (!options.force) {
    const confirmed = await confirm(`Delete profile "${name}"? This cannot be undone. (y/N) `);
    if (!confirmed) {
      warn('Cancelled.');
      return;
    }
  }

  const profileDir = getProfileDir(name);
  rmSync(profileDir, { recursive: true, force: true });
  removeProfile(name);
  success(`Profile "${name}" deleted.`);
};
