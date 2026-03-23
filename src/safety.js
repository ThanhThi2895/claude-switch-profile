import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync, cpSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES_DIR, LOCK_FILE, BACKUP_DIR, CLAUDE_DIR, COPY_ITEMS, COPY_DIRS } from './constants.js';
import { readCurrentItems } from './item-manager.js';
import { findProcess } from './platform.js';
import { warn } from './output-helpers.js';

const MAX_BACKUPS = 2;

// Acquire a lock file — atomic O_EXCL prevents TOCTOU race
export const acquireLock = () => {
  const lockPath = join(PROFILES_DIR, LOCK_FILE);

  try {
    writeFileSync(lockPath, String(process.pid) + '\n', { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Lock exists — check if stale
      const content = readFileSync(lockPath, 'utf-8').trim();
      const pid = parseInt(content, 10);

      if (pid && !isProcessRunning(pid)) {
        unlinkSync(lockPath);
        writeFileSync(lockPath, String(process.pid) + '\n', { flag: 'wx' });
      } else {
        throw new Error(`Another csp operation is running (PID: ${content}). Remove ${lockPath} if stale.`);
      }
    } else {
      throw err;
    }
  }
};

// Release the lock file
export const releaseLock = () => {
  const lockPath = join(PROFILES_DIR, LOCK_FILE);
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    // Best effort
  }
};

// Wrapper that acquires/releases lock around async function
export const withLock = async (fn) => {
  acquireLock();
  try {
    return await fn();
  } finally {
    releaseLock();
  }
};

// Check if a PID is still running
const isProcessRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Check if claude process is running (cross-platform)
export const isClaudeRunning = () => {
  return findProcess('claude');
};

// Print warning if Claude is detected running
export const warnIfClaudeRunning = () => {
  if (isClaudeRunning()) {
    warn('Claude Code appears to be running. Restart your Claude session after switching profiles.');
  }
};

// Create backup of current managed items, prune old backups
export const createBackup = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBase = join(PROFILES_DIR, BACKUP_DIR);
  const backupPath = join(backupBase, timestamp);
  mkdirSync(backupPath, { recursive: true });

  // Save symlink targets
  const sourceMap = readCurrentItems();
  writeFileSync(join(backupPath, 'source.json'), JSON.stringify(sourceMap, null, 2) + '\n');

  // Copy mutable files
  for (const item of COPY_ITEMS) {
    const src = join(CLAUDE_DIR, item);
    if (existsSync(src)) cpSync(src, join(backupPath, item));
  }

  // Copy dirs
  for (const dir of COPY_DIRS) {
    const src = join(CLAUDE_DIR, dir);
    if (existsSync(src)) cpSync(src, join(backupPath, dir), { recursive: true });
  }

  // Prune old backups — keep only MAX_BACKUPS most recent
  try {
    const backups = readdirSync(backupBase).sort();
    while (backups.length > MAX_BACKUPS) {
      const oldest = backups.shift();
      rmSync(join(backupBase, oldest), { recursive: true, force: true });
    }
  } catch {
    // Non-critical — skip pruning
  }

  return backupPath;
};
