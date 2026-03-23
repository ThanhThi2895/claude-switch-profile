import { existsSync, copyFileSync, cpSync, unlinkSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_DIR, COPY_ITEMS, COPY_DIRS } from './constants.js';

// Copy COPY_ITEMS files + COPY_DIRS dirs from ~/.claude to profileDir
export const saveFiles = (profileDir) => {
  mkdirSync(profileDir, { recursive: true });

  for (const item of COPY_ITEMS) {
    const src = join(CLAUDE_DIR, item);
    if (existsSync(src)) {
      copyFileSync(src, join(profileDir, item));
    }
  }

  for (const dir of COPY_DIRS) {
    const src = join(CLAUDE_DIR, dir);
    if (existsSync(src)) {
      const dest = join(profileDir, dir);
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
    }
  }
};

// Copy files + dirs from profileDir back to ~/.claude
export const restoreFiles = (profileDir) => {
  for (const item of COPY_ITEMS) {
    const src = join(profileDir, item);
    if (existsSync(src)) {
      copyFileSync(src, join(CLAUDE_DIR, item));
    }
  }

  for (const dir of COPY_DIRS) {
    const src = join(profileDir, dir);
    if (existsSync(src)) {
      const dest = join(CLAUDE_DIR, dir);
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
    }
  }
};

// Remove managed COPY_ITEMS files and COPY_DIRS from ~/.claude
export const removeFiles = () => {
  for (const item of COPY_ITEMS) {
    const itemPath = join(CLAUDE_DIR, item);
    try {
      if (existsSync(itemPath)) unlinkSync(itemPath);
    } catch {
      // Skip
    }
  }

  for (const dir of COPY_DIRS) {
    const dirPath = join(CLAUDE_DIR, dir);
    try {
      if (existsSync(dirPath)) rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // Skip
    }
  }
};

/**
 * Update absolute paths in settings.json.
 * Direction: 'save' replaces CLAUDE_DIR → profileDir, 'restore' replaces profileDir → CLAUDE_DIR.
 * @param {string} targetDir - The directory containing settings.json to update
 * @param {'save'|'restore'} direction - Direction of path replacement
 * @param {string} [profileDir] - Profile directory (required for 'restore' mode)
 */
export const updateSettingsPaths = (targetDir, direction = 'save', profileDir = null) => {
  const settingsPath = join(targetDir, 'settings.json');
  if (!existsSync(settingsPath)) return;

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    let updated = raw;

    let fromPath, toPath;
    if (direction === 'save') {
      fromPath = CLAUDE_DIR;
      toPath = targetDir;
    } else {
      // restore: replace profileDir refs with CLAUDE_DIR
      fromPath = profileDir || targetDir;
      toPath = CLAUDE_DIR;
    }

    // Handle both backslash (Windows JSON-escaped) and forward-slash variants
    const fromEscaped = fromPath.replaceAll('\\', '\\\\');
    const toEscaped = toPath.replaceAll('\\', '\\\\');
    const fromFwd = fromPath.replaceAll('\\', '/');
    const toFwd = toPath.replaceAll('\\', '/');

    updated = updated.replaceAll(fromEscaped, toEscaped);
    updated = updated.replaceAll(fromFwd, toFwd);
    // Also handle raw backslash paths (single backslash in non-JSON context)
    if (fromPath !== fromEscaped) {
      updated = updated.replaceAll(fromPath, toPath);
    }

    if (updated !== raw) {
      writeFileSync(settingsPath, updated);
    }
  } catch { /* parse error — skip */ }
};
