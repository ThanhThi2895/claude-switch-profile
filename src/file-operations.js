import { existsSync, copyFileSync, cpSync, unlinkSync, rmSync, mkdirSync } from 'node:fs';
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
