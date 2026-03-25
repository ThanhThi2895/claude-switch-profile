import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { profileExists, getProfileDir, getActive } from '../profile-store.js';
import { saveItems } from '../item-manager.js';
import { saveFiles, updateSettingsPaths } from '../file-operations.js';
import { success, error, info } from '../output-helpers.js';
import { DEFAULT_PROFILE } from '../constants.js';

export const exportCommand = (name, options) => {
  if (name === DEFAULT_PROFILE) {
    error('Cannot export the default profile (it uses ~/.claude directly).');
    process.exit(1);
  }

  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const profileDir = getProfileDir(name);
  const output = options.output || `./${name}.csp.tar.gz`;
  const outputPath = resolve(output);

  // If exporting active profile, save a copy first (non-destructive)
  const active = getActive();
  if (active === name) {
    saveItems(profileDir);
    saveFiles(profileDir);
    updateSettingsPaths(profileDir, 'save');
    info('Saved current state before export.');
  }

  try {
    execFileSync('tar', ['-czf', outputPath, '-C', profileDir, '.'], { stdio: 'pipe' });
    success(`Profile "${name}" exported to ${outputPath}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      error('tar command not found. On Windows, tar is available on Windows 10+.');
    } else {
      error(`Failed to export: ${err.message}`);
    }
    process.exit(1);
  }
};
