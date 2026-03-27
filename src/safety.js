import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync, cpSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES_DIR, LOCK_FILE, BACKUP_DIR, CLAUDE_DIR, COPY_ITEMS, COPY_DIRS } from './constants.js';
import { readCurrentItems } from './item-manager.js';
import { findProcess } from './platform.js';
import { warn } from './output-helpers.js';

const CLAUDE_RUNNING_ERROR = 'Claude Code appears to be running. Close all Claude sessions before switching profiles.';

const MAX_BACKUPS = 2;

const isProcessRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const acquireLockFile = (lockPath) => {
  mkdirSync(PROFILES_DIR, { recursive: true });

  try {
    writeFileSync(lockPath, String(process.pid) + '\n', { flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;

    const content = readFileSync(lockPath, 'utf-8').trim();
    const pid = parseInt(content, 10);

    if (pid && !isProcessRunning(pid)) {
      unlinkSync(lockPath);
      writeFileSync(lockPath, String(process.pid) + '\n', { flag: 'wx' });
      return;
    }

    throw new Error(`Another csp operation is running (PID: ${content}). Remove ${lockPath} if stale.`);
  }
};

const releaseLockFile = (lockPath) => {
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    // Best effort
  }
};

// Acquire a lock file — atomic O_EXCL prevents TOCTOU race
export const acquireLock = () => {
  const lockPath = join(PROFILES_DIR, LOCK_FILE);
  acquireLockFile(lockPath);
};

// Release the lock file
export const releaseLock = () => {
  const lockPath = join(PROFILES_DIR, LOCK_FILE);
  releaseLockFile(lockPath);
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

const runtimeLockName = (profileName) => {
  return `.runtime.${profileName}.lock`;
};

export const acquireRuntimeLock = (profileName) => {
  const lockPath = join(PROFILES_DIR, runtimeLockName(profileName));
  acquireLockFile(lockPath);
};

export const releaseRuntimeLock = (profileName) => {
  const lockPath = join(PROFILES_DIR, runtimeLockName(profileName));
  releaseLockFile(lockPath);
};

export const withRuntimeLock = async (profileName, fn) => {
  acquireRuntimeLock(profileName);
  try {
    return await fn();
  } finally {
    releaseRuntimeLock(profileName);
  }
};

// Check if claude process is running (cross-platform)
export const isClaudeRunning = () => {
  if (process.env.NODE_ENV === 'test') {
    if (process.env.CSP_TEST_CLAUDE_RUNNING === '1') return true;
    if (process.env.CSP_TEST_CLAUDE_RUNNING === '0') return false;
  }

  return findProcess('claude');
};

// Print warning if Claude is detected running
export const warnIfClaudeRunning = () => {
  if (isClaudeRunning()) {
    warn('Claude Code appears to be running. Restart your Claude session after switching profiles.');
  }
};

export const assertClaudeNotRunning = (processChecker = isClaudeRunning) => {
  if (processChecker()) {
    throw new Error(CLAUDE_RUNNING_ERROR);
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
