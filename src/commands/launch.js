import { spawn } from 'node:child_process';
import { getActive, profileExists } from '../profile-store.js';
import { useCommand } from './use.js';
import { deactivateCommand } from './deactivate.js';
import { error, info, warn } from '../output-helpers.js';

export const launchCommand = async (name, claudeArgs, _options) => {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist. Run "csp list" to see available profiles.`);
    process.exit(1);
  }

  // Remember previous state for restore after Claude exits
  const previousProfile = getActive();

  // Switch to target profile
  await useCommand(name, { save: true });

  // Launch Claude with forwarded args
  const args = claudeArgs || [];
  info(`Launching: claude ${args.join(' ')}`.trim());

  const child = spawn('claude', args, {
    stdio: 'inherit',
    shell: false,
    detached: false,
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
    restorePrevious(previousProfile, name);
    process.exit(1);
  });

  // When Claude exits, restore previous profile
  child.on('exit', async (code) => {
    process.removeListener('SIGINT', forwardSignal);
    process.removeListener('SIGTERM', forwardSignal);
    await restorePrevious(previousProfile, name);
    process.exit(code || 0);
  });

  // Keep process alive while Claude runs
  return new Promise(() => {});
};

/**
 * Restore previous profile state after temporary launch session ends.
 */
const restorePrevious = async (previousProfile, currentProfile) => {
  try {
    if (previousProfile && profileExists(previousProfile) && previousProfile !== currentProfile) {
      // Restore previous profile
      info(`Session ended. Restoring profile "${previousProfile}"...`);
      await useCommand(previousProfile, { save: false, skipClaudeCheck: true });
    } else if (!previousProfile) {
      // No previous profile — deactivate
      info('Session ended. Deactivating temporary profile...');
      await deactivateCommand({ save: true, skipClaudeCheck: true });
    } else {
      // Same profile or previous no longer exists — just save current state
      info('Session ended.');
    }
  } catch (err) {
    warn(`Failed to restore previous profile: ${err.message}`);
  }
};
