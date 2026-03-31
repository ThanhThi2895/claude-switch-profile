import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, lstatSync, readlinkSync, readdirSync, rmSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { addProfile, profileExists, getProfileDir, ensureProfilesDir } from '../profile-store.js';
import { isWindows } from '../platform.js';
import { validateProfile } from '../profile-validator.js';
import { MANAGED_ITEMS, COPY_ITEMS, COPY_DIRS } from '../constants.js';
import { success, error, warn } from '../output-helpers.js';

const IMPORT_SAFE_ITEMS = [...new Set([...MANAGED_ITEMS, ...COPY_ITEMS, ...COPY_DIRS])];

const isWithinDir = (baseDir, targetPath) => {
  const normalizedBase = resolve(baseDir);
  const normalizedTarget = resolve(targetPath);
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase + '/');
};

const findUnsafeManagedSymlink = (profileDir) => {
  const pending = IMPORT_SAFE_ITEMS.map((item) => join(profileDir, item)).filter((itemPath) => existsSync(itemPath));

  while (pending.length > 0) {
    const currentPath = pending.pop();
    const stat = lstatSync(currentPath);

    if (stat.isSymbolicLink()) {
      const linkTarget = readlinkSync(currentPath);
      const resolvedTarget = resolve(dirname(currentPath), linkTarget);
      if (!isWithinDir(profileDir, resolvedTarget)) {
        return { path: currentPath, target: linkTarget };
      }
      continue;
    }

    if (!stat.isDirectory()) continue;

    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      pending.push(join(currentPath, entry.name));
    }
  }

  return null;
};

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

  const tarArgs = isWindows
    ? ['--force-local', '-xzf', filePath, '-C', profileDir.replace(/\\/g, '/')]
    : ['-xzf', filePath, '-C', profileDir];

  try {
    execFileSync(isWindows ? 'tar.exe' : 'tar', tarArgs, { stdio: 'pipe' });
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

  const unsafeSymlink = findUnsafeManagedSymlink(profileDir);
  if (unsafeSymlink) {
    rmSync(profileDir, { recursive: true, force: true });
    error(
      `Imported profile contains an unsafe symlink outside the profile tree: ${unsafeSymlink.path} -> ${unsafeSymlink.target}`,
    );
    process.exit(1);
  }

  addProfile(name, { description: options.description || `Imported from ${basename(file)}` });
  success(`Profile "${name}" imported from ${filePath}`);
};
