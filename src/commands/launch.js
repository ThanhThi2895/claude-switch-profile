import { execFileSync, spawn } from 'node:child_process';
import { basename, join } from 'node:path';
import { accessSync, constants as fsConstants, existsSync } from 'node:fs';
import { info, error } from '../output-helpers.js';
import { useCommand } from './use.js';
import { isWindows } from '../platform.js';
import { LAUNCH_CONFIG_ENV } from '../constants.js';
import {
  ensureLaunchProfileReady,
  formatLaunchEnvDiagnostics,
  resolveIsolatedLaunchContext,
  stripInheritedLaunchEnv,
} from '../isolated-launch-context.js';

export { ensureLaunchProfileReady, formatLaunchEnvDiagnostics, resolveIsolatedLaunchContext, stripInheritedLaunchEnv };

const SHELL_REASSERT_ENV_KEYS = [LAUNCH_CONFIG_ENV, 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'];
const SAFE_SHELL_COMMAND = /^[A-Za-z0-9_./:@%+-]+$/;

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

  return {
    command: /\.(cmd|bat)$/i.test(resolvedPath) ? `"${resolvedPath}"` : resolvedPath,
    shell: /\.(cmd|bat)$/i.test(resolvedPath),
  };
};

export const resolveExecTarget = (command, env = process.env, dependencies = {}) => {
  const windows = dependencies.isWindows ?? isWindows;
  if (!windows) {
    return { command, shell: false };
  }

  const execRunner = dependencies.execFileSync || execFileSync;
  const fileName = basename(command || '').toLowerCase();
  if (/\.(cmd|bat)$/i.test(command || '') || fileName === 'cmd' || fileName === 'cmd.exe') {
    return {
      command: /\s/.test(command || '') ? `"${command}"` : command,
      shell: true,
    };
  }

  try {
    const resolvedPath = execRunner('where.exe', [command], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env,
    })
      .trim()
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);

    if (resolvedPath && /\.(cmd|bat)$/i.test(resolvedPath)) {
      return { command, shell: true };
    }
  } catch {
    // Fall back to default non-shell spawn behavior.
  }

  return { command, shell: false };
};

const runSpawnedCommand = ({ command, args = [], env, shell = false, errorLabel }) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell,
    detached: false,
    env,
  });

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
    error(`${errorLabel}: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.removeListener('SIGINT', forwardSignal);
    process.removeListener('SIGTERM', forwardSignal);
    process.exit(code || 0);
  });

  return new Promise(() => {});
};

const formatCommand = (command, args = []) => {
  return [command, ...args].filter((part) => part !== undefined && part !== null && String(part).length > 0).join(' ');
};

const quoteShellToken = (value) => `'${String(value).replaceAll("'", `'"'"'`)}'`;
const formatShellCommandToken = (value) => (SAFE_SHELL_COMMAND.test(String(value || '')) ? String(value) : quoteShellToken(value));
const isExecutableFile = (filePath) => {
  if (!filePath) return false;
  try {
    accessSync(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
};
const getInteractiveShellPath = (env = process.env) => {
  if (isExecutableFile(env.SHELL)) return env.SHELL;
  return '/bin/sh';
};

const buildShellEvalCommand = (command, args = []) => {
  return [formatShellCommandToken(command), ...args.map((arg) => quoteShellToken(arg))].join(' ');
};

const buildShellEnvReassertion = (env) => {
  return SHELL_REASSERT_ENV_KEYS.map((key) => {
    if (Object.prototype.hasOwnProperty.call(env, key) && env[key] !== undefined) {
      return `export ${key}=${quoteShellToken(env[key])}`;
    }
    return `unset ${key}`;
  }).join('; ');
};

const executeViaInteractiveShell = ({ command, args = [], launchEnv, errorLabel }) => {
  const shellPath = getInteractiveShellPath(launchEnv);
  const shellEnv = { ...launchEnv, CSP_EXEC_CMD: buildShellEvalCommand(command, args) };
  const shellScript = `${buildShellEnvReassertion(launchEnv)}; eval "$CSP_EXEC_CMD"`;

  return runSpawnedCommand({
    command: shellPath,
    args: ['-ic', shellScript],
    env: shellEnv,
    errorLabel,
  });
};

export const launchCommand = async (name, claudeArgs, options = {}) => {
  ensureLaunchProfileReady(name);

  let args = [...(claudeArgs || [])];
  if (options.legacyGlobal || args.includes('--legacy-global')) {
    args = args.filter((arg) => arg !== '--legacy-global');
    await useCommand(name, { save: true, skipClaudeCheck: true });
    info(`Launching legacy/global mode: claude ${args.join(' ')}`.trim());
    return runSpawnedCommand({ command: 'claude', args, env: { ...process.env }, errorLabel: 'Failed to launch Claude' });
  }

  const isolated = await resolveIsolatedLaunchContext(name, process.env);
  const launchEnv = isolated.launchEnv;

  info(`Launch env diagnostics (${name}): ${formatLaunchEnvDiagnostics(isolated.diagnostics)}`);
  info(`CLAUDE_CONFIG_DIR=${launchEnv[LAUNCH_CONFIG_ENV]}`);
  info(`ANTHROPIC_AUTH_TOKEN=${launchEnv.ANTHROPIC_AUTH_TOKEN ? `${launchEnv.ANTHROPIC_AUTH_TOKEN.slice(0, 8)}...` : '(not set)'}`);
  info(`ANTHROPIC_BASE_URL=${launchEnv.ANTHROPIC_BASE_URL || '(not set)'}`);

  if (isTruthyDebugValue(process.env.CSP_DEBUG_LAUNCH_ENV)) {
    info(`[DEBUG] Full launch env ANTHROPIC keys: ${JSON.stringify(Object.fromEntries(Object.entries(launchEnv).filter(([key]) => key.startsWith('ANTHROPIC_'))))}`);
  }

  info(`Launching isolated session for profile "${name}": claude ${args.join(' ')}`.trim());

  const launchTarget = resolveClaudeLaunchTarget(launchEnv);
  return runSpawnedCommand({ command: launchTarget.command, args, env: launchEnv, shell: launchTarget.shell, errorLabel: 'Failed to launch Claude' });
};

export const execCommand = async (name, command, commandArgs = []) => {
  ensureLaunchProfileReady(name);

  const normalizedCommand = typeof command === 'string' ? command.trim() : '';
  if (!normalizedCommand) {
    error('Missing command. Usage: csp exec <name> -- <cmd> [args...]');
    process.exit(1);
  }

  const isolated = await resolveIsolatedLaunchContext(name, process.env);
  const launchEnv = isolated.launchEnv;

  info(`Launch env diagnostics (${name}): ${formatLaunchEnvDiagnostics(isolated.diagnostics)}`);
  info(`CLAUDE_CONFIG_DIR=${launchEnv[LAUNCH_CONFIG_ENV]}`);
  info(`Executing isolated command for profile "${name}": ${formatCommand(normalizedCommand, commandArgs)}`);

  if (!isWindows) {
    return executeViaInteractiveShell({
      command: normalizedCommand,
      args: commandArgs,
      launchEnv,
      errorLabel: `Failed to execute command "${normalizedCommand}"`,
    });
  }

  const execTarget = resolveExecTarget(normalizedCommand, launchEnv);
  return runSpawnedCommand({
    command: execTarget.command,
    args: commandArgs,
    env: launchEnv,
    shell: execTarget.shell,
    errorLabel: `Failed to execute command "${normalizedCommand}"`,
  });
};
