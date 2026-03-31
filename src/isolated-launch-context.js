import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { profileExists, ensureDefaultProfileSnapshot } from './profile-store.js';
import { ensureRuntimeInstance } from './runtime-instance-manager.js';
import { withRuntimeLock } from './safety.js';
import { error, warn } from './output-helpers.js';
import { LAUNCH_CONFIG_ENV, DEFAULT_PROFILE } from './constants.js';
import {
  buildEffectiveLaunchEnv,
  parseDotEnvLaunchEnv,
  parseSettingsLaunchEnv,
  sanitizeInheritedLaunchEnv,
} from './launch-effective-env-resolver.js';

const readProfileSettingsLaunchEnv = (profileDir) => {
  const settingsPath = join(profileDir, 'settings.json');
  if (!existsSync(settingsPath)) return {};

  try {
    return parseSettingsLaunchEnv(readFileSync(settingsPath, 'utf-8'));
  } catch {
    warn(`Could not parse launch env from ${settingsPath}; falling back to inherited env.`);
    return {};
  }
};

const readProfileDotEnvLaunchEnv = (profileDir) => {
  const dotEnvPath = join(profileDir, '.env');
  if (!existsSync(dotEnvPath)) return {};

  try {
    return parseDotEnvLaunchEnv(readFileSync(dotEnvPath, 'utf-8'));
  } catch {
    warn(`Could not parse launch env from ${dotEnvPath}; falling back to inherited env.`);
    return {};
  }
};

const readProfileLaunchEnvSources = (runtimeDir) => {
  return {
    profileSettingsEnv: readProfileSettingsLaunchEnv(runtimeDir),
    profileDotEnvEnv: readProfileDotEnvLaunchEnv(runtimeDir),
  };
};

export const formatLaunchEnvDiagnostics = (diagnostics = {}) => {
  const keys = diagnostics.anthropicKeys || [];
  const sources = diagnostics.anthropicKeySources || {};

  if (!keys.length) {
    return 'ANTHROPIC_* keys: none';
  }

  return `ANTHROPIC_* keys: ${keys.map((key) => `${key}<=${sources[key] || 'unknown'}`).join(', ')}`;
};

export const stripInheritedLaunchEnv = (env = process.env) => {
  const sanitized = sanitizeInheritedLaunchEnv(env);
  for (const key of Object.keys(sanitized)) {
    if (key.toUpperCase().startsWith('ANTHROPIC_')) {
      delete sanitized[key];
    }
  }
  return sanitized;
};

export const ensureLaunchProfileReady = (name) => {
  if (name === DEFAULT_PROFILE) {
    try {
      ensureDefaultProfileSnapshot();
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  }

  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist. Run "csp list" to see available profiles.`);
    process.exit(1);
  }
};

export const resolveIsolatedLaunchContext = async (name, parentEnv = process.env) => {
  const runtimeDir = await withRuntimeLock(name, async () => ensureRuntimeInstance(name));
  const { profileSettingsEnv, profileDotEnvEnv } = readProfileLaunchEnvSources(runtimeDir);
  const { launchEnv: resolvedLaunchEnv, diagnostics } = buildEffectiveLaunchEnv({
    parentEnv,
    profileSettingsEnv,
    profileDotEnvEnv,
  });

  return {
    runtimeDir,
    diagnostics,
    launchEnv: {
      ...resolvedLaunchEnv,
      [LAUNCH_CONFIG_ENV]: runtimeDir,
    },
  };
};
