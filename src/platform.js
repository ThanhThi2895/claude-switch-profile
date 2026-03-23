import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const isWindows = process.platform === 'win32';

/**
 * Get symlink type for Windows compatibility.
 * On Windows: always 'junction' (no admin required).
 * On Unix: undefined (default behavior).
 */
export const symlinkType = (_targetPath) => {
  if (!isWindows) return undefined;
  return 'junction';
};

/**
 * Check if a process with the given name is running.
 * Windows: uses tasklist. Unix: uses pgrep.
 */
export const findProcess = (name) => {
  try {
    if (isWindows) {
      const result = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/NH'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return result.includes(`${name}.exe`);
    } else {
      const result = execFileSync('pgrep', ['-x', name], { encoding: 'utf-8' });
      return result.trim().length > 0;
    }
  } catch {
    return false;
  }
};
