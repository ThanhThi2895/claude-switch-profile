import { spawn } from 'node:child_process';
import { profileExists } from '../profile-store.js';
import { useCommand } from './use.js';
import { error, info } from '../output-helpers.js';

export const launchCommand = async (name, claudeArgs, _options) => {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist. Run "csp list" to see available profiles.`);
    process.exit(1);
  }

  // Switch to target profile (if not already active)
  // skipClaudeCheck: launch intentionally runs Claude, skip tasklist (~140ms)
  await useCommand(name, { save: true, skipClaudeCheck: true });

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
