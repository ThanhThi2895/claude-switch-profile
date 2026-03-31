import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { profileExists, ensureDefaultProfileSnapshot } from '../profile-store.js';
import { useCommand } from './use.js';
import { ensureRuntimeInstance } from '../runtime-instance-manager.js';
import { withRuntimeLock } from '../safety.js';
import { error, info, warn } from '../output-helpers.js';
import { isWindows } from '../platform.js';
import { LAUNCH_CONFIG_ENV, DEFAULT_PROFILE } from '../constants.js';
import { buildEffectiveLaunchEnv, parseDotEnvLaunchEnv, parseSettingsLaunchEnv, sanitizeInheritedLaunchEnv } from '../launch-effective-env-resolver.js';

const isTruthyDebugValue = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const findWindowsClaudePath = (env, dependencies = {}) => {
  const execRunner = dependencies.execFileSync || execFileSync;
  const pathExists = dependencies.existsSync || existsSync;

  const pathMatches = (() => {
    try {
      return execRunner('where.exe', ['claude'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env,
      })
        .trim()
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  })();

  const resolvedFromPath = pathMatches.find((entry) => /\.(exe|cmd|bat)$/i.test(entry)) || pathMatches[0];
  if (resolvedFromPath && pathExists(resolvedFromPath)) {
    return resolvedFromPath;
  }

  const fallbackCandidates = [
    env.USERPROFILE ? join(env.USERPROFILE, '.local', 'bin', 'claude.exe') : null,
    env.APPDATA ? join(env.APPDATA, 'npm', 'claude.cmd') : null,
    env.USERPROFILE ? join(env.USERPROFILE, '.bun', 'bin', 'claude.exe') : null,
  ].filter(Boolean);

  return fallbackCandidates.find((candidate) => pathExists(candidate)) || null;
};

export const resolveClaudeLaunchTarget = (env = process.env, dependencies = {}) => {
  const windows = dependencies.isWindows ?? isWindows;
  if (!windows) {
    return { command: 'claude', shell: false };
  }

  const resolvedPath = findWindowsClaudePath(env, dependencies);
  if (!resolvedPath) {
    return { command: 'claude', shell: true };
  }

  const requiresShell = /\.(cmd|bat)$/i.test(resolvedPath);

  return {
    command: requiresShell ? `"${resolvedPath}"` : resolvedPath,
    shell: requiresShell,
  };
};

const readProfileSettingsLaunchEnv = (profileDir) => {
  const settingsPath = join(profileDir, 'settings.json');
  if (!existsSync(settingsPath)) return {};

  try {
    const rawSettings = readFileSync(settingsPath, 'utf-8');
    return parseSettingsLaunchEnv(rawSettings);
  } catch {
    warn(`Could not parse launch env from ${settingsPath}; falling back to inherited env.`);
    return {};
  }
};

const readProfileDotEnvLaunchEnv = (profileDir) => {
  const dotEnvPath = join(profileDir, '.env');
  if (!existsSync(dotEnvPath)) return {};

  try {
    const rawDotEnv = readFileSync(dotEnvPath, 'utf-8');
    return parseDotEnvLaunchEnv(rawDotEnv);
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

const formatLaunchEnvDiagnostics = (diagnostics = {}) => {
  const keys = diagnostics.anthropicKeys || [];
  const sources = diagnostics.anthropicKeySources || {};

  if (!keys.length) {
    return 'ANTHROPIC_* keys: none';
  }

  const keyDetails = keys
    .map((key) => `${key}<=${sources[key] || 'unknown'}`)
    .join(', ');

  return `ANTHROPIC_* keys: ${keyDetails}`;
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

export const launchCommand = async (name, claudeArgs, options = {}) => {
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

  let args = [...(claudeArgs || [])];
  const legacyFromArgs = args.includes('--legacy-global');
  if (legacyFromArgs) {
    args = args.filter((a) => a !== '--legacy-global');
  }

  let launchEnv = { ...process.env };

  if (options.legacyGlobal || legacyFromArgs) {
    await useCommand(name, { save: true, skipClaudeCheck: true });
    info(`Launching legacy/global mode: claude ${args.join(' ')}`.trim());
  } else {
    const runtimeDir = await withRuntimeLock(name, async () => ensureRuntimeInstance(name));
    const { profileSettingsEnv, profileDotEnvEnv } = readProfileLaunchEnvSources(runtimeDir);
    const { launchEnv: resolvedLaunchEnv, diagnostics } = buildEffectiveLaunchEnv({
      parentEnv: process.env,
      profileSettingsEnv,
      profileDotEnvEnv,
    });

    launchEnv = {
      ...resolvedLaunchEnv,
      [LAUNCH_CONFIG_ENV]: runtimeDir,
    };

    // CLAUDE_CONFIG_DIR already redirects user-level config lookups to the
    // runtime dir, so the "user" settings source reads {runtimeDir}/settings.json
    // — which is the correct profile-specific settings. We do NOT exclude "user"
    // because Claude Code gates skill/hook discovery on it being enabled.

    // Always show launch diagnostics for debugging credential issues
    info(`Launch env diagnostics (${name}): ${formatLaunchEnvDiagnostics(diagnostics)}`);
    info(`CLAUDE_CONFIG_DIR=${launchEnv[LAUNCH_CONFIG_ENV]}`);
    info(`ANTHROPIC_AUTH_TOKEN=${launchEnv.ANTHROPIC_AUTH_TOKEN ? launchEnv.ANTHROPIC_AUTH_TOKEN.slice(0, 8) + '...' : '(not set)'}`);
    info(`ANTHROPIC_BASE_URL=${launchEnv.ANTHROPIC_BASE_URL || '(not set)'}`);

    if (isTruthyDebugValue(process.env.CSP_DEBUG_LAUNCH_ENV)) {
      info(`[DEBUG] Full launch env ANTHROPIC keys: ${JSON.stringify(Object.fromEntries(Object.entries(launchEnv).filter(([k]) => k.startsWith('ANTHROPIC_'))))}`);
    }

    info(`Launching isolated session for profile "${name}": claude ${args.join(' ')}`.trim());
  }

  const launchTarget = resolveClaudeLaunchTarget(launchEnv);

  const child = spawn(launchTarget.command, args, {
    stdio: 'inherit',
    shell: launchTarget.shell,
    detached: false,
    env: launchEnv,
  });

  // Forward signals to child instead of killing parent
  const forwardSignal = (sig) => {
    try {
      child.kill(sig);
    } catch {
      // Child may have already exited
    }
  };
  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('error', (err) => {
    error(`Failed to launch Claude: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.removeListener('SIGINT', forwardSignal);
    process.removeListener('SIGTERM', forwardSignal);
    process.exit(code || 0);
  });

  // Keep process alive while Claude runs
  return new Promise(() => {});
};
