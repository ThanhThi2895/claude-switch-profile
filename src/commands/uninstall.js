import { existsSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { getActive, profileExists, getProfileDir } from '../profile-store.js';
import { removeItems, restoreItems } from '../item-manager.js';
import { removeFiles, restoreFiles } from '../file-operations.js';
import { withLock, createBackup, warnIfClaudeRunning } from '../safety.js';
import { PROFILES_DIR, DEFAULT_PROFILE } from '../constants.js';
import { success, error, info, warn } from '../output-helpers.js';

const confirm = (question) => {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
};

export const uninstallCommand = async (options) => {
  const active = getActive();

  if (!existsSync(PROFILES_DIR)) {
    info('No profiles directory found. CSP is not initialized.');
    info('To remove the CLI: npm uninstall -g claude-switch-profile');
    return;
  }

  // Show what will happen
  console.log('');
  info('This will:');
  if (options.profile && profileExists(options.profile)) {
    info(`  1. Restore profile "${options.profile}" to ~/.claude`);
  } else if (active && active !== DEFAULT_PROFILE && profileExists(active)) {
    info(`  1. Restore active profile "${active}" to ~/.claude (use --profile <name> to choose)`);
  } else if (active === DEFAULT_PROFILE) {
    info('  1. Default profile — ~/.claude already in correct state');
  } else {
    warn('  1. No profile to restore (managed items will be removed)');
  }
  info(`  2. Remove all profiles: ${PROFILES_DIR}`);
  info('  3. You can then run: npm uninstall -g claude-switch-profile');
  console.log('');

  if (!options.force) {
    const confirmed = await confirm('Uninstall CSP and remove all profiles? This cannot be undone. (y/N) ');
    if (!confirmed) {
      warn('Cancelled.');
      return;
    }
  }

  warnIfClaudeRunning();

  await withLock(async () => {
    // 1. Create final backup before uninstall
    try {
      const backupPath = createBackup();
      info(`Final backup created at ${backupPath}`);
    } catch {
      // Non-critical — profiles dir may be empty
    }

    // 2. Determine which profile to restore
    const restoreProfile = options.profile || active;

    // 3. Remove current managed items from ~/.claude (skip for default — items live there)
    if (restoreProfile !== DEFAULT_PROFILE) {
      removeItems();
      removeFiles();
    }

    // 4. Restore the chosen profile's config
    if (restoreProfile === DEFAULT_PROFILE) {
      info('Default profile — ~/.claude already in correct state.');
    } else if (restoreProfile && profileExists(restoreProfile)) {
      const profileDir = getProfileDir(restoreProfile);
      // If restoring the active profile: items already in ~/.claude (moved there on switch)
      // If restoring a different profile: need to restore from profileDir
      if (restoreProfile !== active) {
        restoreItems(profileDir);
        restoreFiles(profileDir);
      }
      success(`Restored "${restoreProfile}" profile to ~/.claude`);
    } else {
      warn('No profile restored. ~/.claude managed items have been cleared.');
    }
  });

  // 5. Remove profiles directory (after lock is released)
  rmSync(PROFILES_DIR, { recursive: true, force: true });
  success('Removed all profiles and CSP data.');

  console.log('');
  info('To complete uninstall, run:');
  info('  npm uninstall -g claude-switch-profile');
  info('');
  info('Restart your Claude Code session to apply changes.');
};
