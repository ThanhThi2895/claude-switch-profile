import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { profileExists, getProfileDir } from '../profile-store.js';
import { success, error } from '../output-helpers.js';

export const exportCommand = (name, options) => {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const profileDir = getProfileDir(name);
  const output = options.output || `./${name}.csp.tar.gz`;
  const outputPath = resolve(output);

  try {
    execFileSync('tar', ['-czf', outputPath, '-C', profileDir, '.'], { stdio: 'pipe' });
    success(`Profile "${name}" exported to ${outputPath}`);
  } catch (err) {
    error(`Failed to export: ${err.message}`);
    process.exit(1);
  }
};
