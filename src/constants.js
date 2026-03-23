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

// Items managed via copy (formerly symlinks — now always copied)
export const MANAGED_ITEMS = [
  'CLAUDE.md',
  'rules',
  'agents',
  'skills',
  'hooks',
  'statusline.cjs',
  'statusline.sh',
  'statusline.ps1',
  '.luna.json',
];

// Directory-type managed items (auto-created in new profiles)
export const MANAGED_DIRS = ['rules', 'agents', 'skills', 'hooks'];

// Mutable files managed via copy
export const COPY_ITEMS = [
  'settings.json',
  '.env',
  '.ck.json',
  '.ckignore',
  '.mcp.json',
  '.mcp.json.example',
  '.env.example',
  '.gitignore',
];

// Directories managed via copy
export const COPY_DIRS = [
  'commands',
  'plugins',
  'workflows',
  'scripts',
  'output-styles',
  'schemas',
];

// Items to NEVER clone (runtime/cache/tracking)
export const NEVER_CLONE = [
  '.credentials.json',
  'projects',
  'sessions',
  'session-env',
  'ide',
  'cache',
  'paste-cache',
  'downloads',
  'stats-cache.json',
  'active-plan',
  'history.jsonl',
  'metadata.json',
  'telemetry',
  'debug',
  'statsig',
  'backups',
  'command-archive',
  'commands-archived',
  'todos',
  'tasks',
  'teams',
  'agent-memory',
  'plans',
  'file-history',
  'shell-snapshots',
];

// Never touch these — runtime/session data (same scope as NEVER_CLONE)
export const NEVER_TOUCH = [...NEVER_CLONE];

// All managed items (managed + copies + copy dirs)
export const ALL_MANAGED = [...MANAGED_ITEMS, ...COPY_ITEMS, ...COPY_DIRS];
