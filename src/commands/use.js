import { getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { moveItemsToProfile, moveItemsToClaude, saveItems, removeItems } from '../item-manager.js';
import { saveFiles, removeFiles, restoreFiles, updateSettingsPaths, moveDirsToProfile, moveDirsToClaude } from '../file-operations.js';
import { validateProfile } from '../profile-validator.js';
import { withLock, warnIfClaudeRunning } from '../safety.js';
import { success, error, info, warn } from '../output-helpers.js';
import { CLAUDE_DIR, DEFAULT_PROFILE } from '../constants.js';

export const useCommand = async (name, options) => {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist. Run "csp list" to see available profiles.`);
    process.exit(1);
  }

  const active = getActive();
  if (active === name) {
    info(`Profile "${name}" is already active.`);
    return;
  }

  const profileDir = getProfileDir(name);

  // Validate target profile (skip for default — it's a pass-through)
  if (name !== DEFAULT_PROFILE) {
    const validation = validateProfile(profileDir);
    if (!validation.valid) {
      error(`Profile "${name}" is invalid:`);
      validation.errors.forEach((e) => error(`  ${e}`));
      process.exit(1);
    }
  }

  if (options.dryRun) {
    info(`[Dry run] Would switch from "${active || 'none'}" to "${name}"`);
    info(`[Dry run] Profile dir: ${profileDir}`);
    return;
  }

  if (!options.skipClaudeCheck) warnIfClaudeRunning();

  await withLock(async () => {
    // 1. Save current state (skip if from=default — ~/.claude IS default)
    if (active && active !== DEFAULT_PROFILE && profileExists(active) && options.save !== false) {
      const activeDir = getProfileDir(active);
      if (name === DEFAULT_PROFILE) {
        saveItems(activeDir);
        saveFiles(activeDir);
      } else {
        moveItemsToProfile(activeDir);
        saveFiles(activeDir);
        moveDirsToProfile(activeDir);
      }
      updateSettingsPaths(activeDir, 'save');
      info(`Saved current state to "${active}"`);
    }

    // 2. Remove leftovers only when switching to non-default
    if (name !== DEFAULT_PROFILE) {
      if (active !== DEFAULT_PROFILE) {
        removeItems();
      }
      removeFiles();
    }

    // 3. Restore target (skip if to=default — ~/.claude already correct)
    if (name !== DEFAULT_PROFILE) {
      try {
        moveItemsToClaude(profileDir);
        restoreFiles(profileDir);
        moveDirsToClaude(profileDir);
        updateSettingsPaths(CLAUDE_DIR, 'restore', profileDir);
      } catch (err) {
        warn(`Switch failed: ${err.message}`);
        error('Manual recovery: re-run "csp use <profile>" or restore from profile directory.');
        throw err;
      }
    }

    // 4. Update active marker
    setActive(name);

    success(`Switched to profile "${name}"`);
    if (name === DEFAULT_PROFILE) {
      info('Using ~/.claude directly (default profile).');
    } else {
      info('Restart your Claude Code session to apply changes.');
    }
  });
};
