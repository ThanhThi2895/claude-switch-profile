import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROFILES_DIR,
  ACTIVE_FILE,
  PROFILES_META,
  CLAUDE_DIR,
  DEFAULT_PROFILE,
  PROFILES_SCHEMA_VERSION,
  RUNTIMES_DIR,
} from './constants.js';

export const ensureProfilesDir = () => {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
};

const normalizeProfileMeta = (name, meta = {}) => {
  const created = typeof meta.created === 'string' ? meta.created : new Date().toISOString();
  const description = typeof meta.description === 'string' ? meta.description : '';
  const mode =
    meta.mode === 'legacy' || meta.mode === 'account-session'
      ? meta.mode
      : name === DEFAULT_PROFILE
        ? 'legacy'
        : 'account-session';
  const runtimeDir = typeof meta.runtimeDir === 'string' && meta.runtimeDir ? meta.runtimeDir : getRuntimeDir(name);
  const runtimeInitializedAt = typeof meta.runtimeInitializedAt === 'string' ? meta.runtimeInitializedAt : null;
  const lastLaunchAt = typeof meta.lastLaunchAt === 'string' ? meta.lastLaunchAt : null;

  return {
    ...meta,
    created,
    description,
    mode,
    runtimeDir,
    runtimeInitializedAt,
    lastLaunchAt,
  };
};

const normalizeProfiles = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const legacyProfiles = raw.profiles && typeof raw.profiles === 'object' ? raw.profiles : raw;

  const normalized = {};
  for (const [name, meta] of Object.entries(legacyProfiles)) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
    normalized[name] = normalizeProfileMeta(name, meta);
  }

  return normalized;
};

export const readProfiles = () => {
  const metaPath = join(PROFILES_DIR, PROFILES_META);
  if (!existsSync(metaPath)) return {};

  try {
    const raw = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return normalizeProfiles(raw);
  } catch {
    return {};
  }
};

export const writeProfiles = (profiles) => {
  ensureProfilesDir();

  const normalized = {};
  for (const [name, meta] of Object.entries(profiles || {})) {
    normalized[name] = normalizeProfileMeta(name, meta);
  }

  const payload = {
    version: PROFILES_SCHEMA_VERSION,
    profiles: normalized,
  };

  writeFileSync(join(PROFILES_DIR, PROFILES_META), JSON.stringify(payload, null, 2) + '\n');
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

const PREVIOUS_FILE = '.previous';

export const getPrevious = () => {
  const prevPath = join(PROFILES_DIR, PREVIOUS_FILE);
  if (!existsSync(prevPath)) return null;
  return readFileSync(prevPath, 'utf-8').trim() || null;
};

export const setPrevious = (name) => {
  ensureProfilesDir();
  writeFileSync(join(PROFILES_DIR, PREVIOUS_FILE), name + '\n');
};

export const addProfile = (name, metadata = {}) => {
  const profiles = readProfiles();
  profiles[name] = normalizeProfileMeta(name, {
    created: new Date().toISOString(),
    description: '',
    ...metadata,
  });
  writeProfiles(profiles);
};

export const removeProfile = (name) => {
  const profiles = readProfiles();
  delete profiles[name];
  writeProfiles(profiles);
};

export const profileExists = (name) => {
  if (name === DEFAULT_PROFILE) return true;
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

export const getRuntimeDir = (name) => {
  validateName(name);
  return join(RUNTIMES_DIR, name);
};

export const getProfileMeta = (name) => {
  const profiles = readProfiles();
  return profiles[name] || null;
};

export const updateProfileMeta = (name, patch) => {
  const profiles = readProfiles();
  if (!profiles[name]) return null;

  const next = typeof patch === 'function' ? patch({ ...profiles[name] }) : { ...profiles[name], ...patch };
  profiles[name] = normalizeProfileMeta(name, next);
  writeProfiles(profiles);
  return profiles[name];
};

export const markRuntimeInitialized = (name, runtimeDir) => {
  const now = new Date().toISOString();
  return updateProfileMeta(name, {
    runtimeDir,
    runtimeInitializedAt: now,
    lastLaunchAt: now,
    mode: 'account-session',
  });
};

export const markProfileLaunched = (name) => {
  return updateProfileMeta(name, {
    lastLaunchAt: new Date().toISOString(),
    mode: 'account-session',
  });
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
