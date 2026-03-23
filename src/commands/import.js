import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { addProfile, profileExists, getProfileDir, ensureProfilesDir } from '../profile-store.js';
import { validateProfile } from '../profile-validator.js';
import { success, error, warn } from '../output-helpers.js';

export const importCommand = (file, options) => {
  const filePath = resolve(file);
  if (!existsSync(filePath)) {
    error(`File "${file}" does not exist.`);
    process.exit(1);
  }

  // Derive name from filename if not provided
  const name = options.name || basename(file).replace(/\.csp\.tar\.gz$/, '').replace(/\.tar\.gz$/, '');

  if (profileExists(name)) {
    error(`Profile "${name}" already exists. Use --name to specify a different name.`);
    process.exit(1);
  }

  ensureProfilesDir();
  const profileDir = getProfileDir(name);
  mkdirSync(profileDir, { recursive: true });

  try {
    execFileSync('tar', ['-xzf', filePath, '-C', profileDir], { stdio: 'pipe' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      error('tar command not found. On Windows, tar is available on Windows 10+.');
    } else {
      error(`Failed to extract: ${err.message}`);
    }
    process.exit(1);
  }

  // Validate imported profile
  const validation = validateProfile(profileDir);
  if (!validation.valid) {
    warn('Imported profile has issues:');
    validation.errors.forEach((e) => warn(`  ${e}`));
  }

  addProfile(name, { description: options.description || `Imported from ${basename(file)}` });
  success(`Profile "${name}" imported from ${filePath}`);
};
