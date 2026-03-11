import { homedir } from 'node:os';
import { join } from 'node:path';

// Allow override via env for testing
const home = process.env.CSP_HOME || homedir();

export const CLAUDE_DIR = process.env.CSP_CLAUDE_DIR || join(home, '.claude');
export const PROFILES_DIR = process.env.CSP_PROFILES_DIR || join(home, '.claude-profiles');

export const ACTIVE_FILE = '.active';
export const PROFILES_META = 'profiles.json';
export const SOURCE_FILE = 'source.json';
export const LOCK_FILE = '.lock';
export const BACKUP_DIR = '.backup';

// Items managed via symlinks — these point to external dirs/files
export const SYMLINK_ITEMS = [
  'CLAUDE.md',
  'rules',
  'agents',
  'skills',
  'hooks',
  'statusline.cjs',
  '.luna.json',
];

// Directory-type symlink items (auto-created in new profiles)
export const SYMLINK_DIRS = ['rules', 'agents', 'skills', 'hooks'];

// Mutable files managed via copy
export const COPY_ITEMS = [
  'settings.json',
  '.env',
  '.ck.json',
  '.ckignore',
];

// Directories managed via copy
export const COPY_DIRS = [
  'commands',
  'plugins',
];

// Never touch these — runtime/session data
export const NEVER_TOUCH = [
  '.credentials.json',
  'projects',
  'backups',
  'cache',
  'debug',
  'telemetry',
  'shell-snapshots',
  'paste-cache',
  'file-history',
  'ide',
  'session-env',
  'todos',
  'tasks',
  'teams',
  'agent-memory',
  'history.jsonl',
  'plans',
];

// All managed items (symlinks + copies + copy dirs)
export const ALL_MANAGED = [...SYMLINK_ITEMS, ...COPY_ITEMS, ...COPY_DIRS];
