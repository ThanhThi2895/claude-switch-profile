import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES_DIR, ACTIVE_FILE, PROFILES_META, CLAUDE_DIR, DEFAULT_PROFILE } from './constants.js';

export const ensureProfilesDir = () => {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
};

export const readProfiles = () => {
  const metaPath = join(PROFILES_DIR, PROFILES_META);
  if (!existsSync(metaPath)) return {};
  return JSON.parse(readFileSync(metaPath, 'utf-8'));
};

export const writeProfiles = (data) => {
  ensureProfilesDir();
  writeFileSync(join(PROFILES_DIR, PROFILES_META), JSON.stringify(data, null, 2) + '\n');
};

export const getActive = () => {
  const activePath = join(PROFILES_DIR, ACTIVE_FILE);
  if (!existsSync(activePath)) return null;
  return readFileSync(activePath, 'utf-8').trim() || null;
};

export const setActive = (name) => {
  ensureProfilesDir();
  writeFileSync(join(PROFILES_DIR, ACTIVE_FILE), name + '\n');
};

export const clearActive = () => {
  const activePath = join(PROFILES_DIR, ACTIVE_FILE);
  try {
    if (existsSync(activePath)) unlinkSync(activePath);
  } catch {
    // Best effort
  }
};

export const addProfile = (name, metadata = {}) => {
  const profiles = readProfiles();
  profiles[name] = {
    created: new Date().toISOString(),
    description: '',
    ...metadata,
  };
  writeProfiles(profiles);
};

export const removeProfile = (name) => {
  const profiles = readProfiles();
  delete profiles[name];
  writeProfiles(profiles);
};

export const profileExists = (name) => {
  return existsSync(getProfileDir(name));
};

// Validate profile name — prevent path traversal and injection
const SAFE_NAME = /^[a-zA-Z0-9_-]+$/;
export const validateName = (name) => {
  if (!name || !SAFE_NAME.test(name)) {
    throw new Error(`Invalid profile name: "${name}". Use only letters, numbers, hyphens, underscores.`);
  }
};

export const getProfileDir = (name) => {
  validateName(name);
  return join(PROFILES_DIR, name);
};

export const listProfileNames = () => {
  return Object.keys(readProfiles());
};

// Returns the directory containing a profile's actual files.
// If profile is active, items were moved to CLAUDE_DIR during switch.
// If profile is not active, items are in profileDir.
export const getEffectiveDir = (name) => {
  if (name === DEFAULT_PROFILE) return CLAUDE_DIR;
  const active = getActive();
  if (active === name) return CLAUDE_DIR;
  return getProfileDir(name);
};
