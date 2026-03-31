import {
  getActive,
  setActive,
  profileExists,
  getProfileDir,
  getProfileMeta,
  setPrevious,
  ensureDefaultProfileSnapshot,
} from '../profile-store.js';
import { moveItemsToProfile, moveItemsToClaude, removeItems } from '../item-manager.js';
import {
  saveFiles,
  removeFiles,
  restoreFiles,
  updateSettingsPaths,
  moveDirsToProfile,
  moveDirsToClaude,
} from '../file-operations.js';
import { validateProfile } from '../profile-validator.js';
import { withLock, assertClaudeNotRunning } from '../safety.js';
import { success, error, info, warn } from '../output-helpers.js';
import { CLAUDE_DIR, DEFAULT_PROFILE } from '../constants.js';

const ensureDefaultProfileIfNeeded = (name) => {
  if (name !== DEFAULT_PROFILE) return;

  try {
    ensureDefaultProfileSnapshot();
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
};

export const useCommand = async (name, options = {}) => {
  if (!options.skipClaudeCheck) {
    warn('Note: "csp use" modifies ~/.claude directly (legacy mode).');
    info('Prefer "csp launch <name>" for isolated sessions that never touch ~/.claude.');
  }

  ensureDefaultProfileIfNeeded(name);

  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist. Run "csp list" to see available profiles.`);
    process.exit(1);
  }

  const active = getActive();
  ensureDefaultProfileIfNeeded(active);

  if (active === name) {
    info(`Profile "${name}" is already active.`);
    return;
  }

  const profileDir = getProfileDir(name);
  const meta = getProfileMeta(name);

  if (meta?.lastLaunchAt) {
    warn(`Profile "${name}" was used in isolated launch mode recently (${meta.lastLaunchAt}).`);
    info('Legacy "csp use" mutates global ~/.claude state.');
  }

  const validation = validateProfile(profileDir);
  if (!validation.valid) {
    error(`Profile "${name}" is invalid:`);
    validation.errors.forEach((validationError) => error(`  ${validationError}`));
    process.exit(1);
  }

  if (options.dryRun) {
    info(`[Dry run] Would switch from "${active || 'none'}" to "${name}"`);
    info(`[Dry run] Profile dir: ${profileDir}`);
    return;
  }

  if (!options.skipClaudeCheck) {
    try {
      assertClaudeNotRunning();
    } catch (err) {
      error(err.message);
      process.exit(1);
    }
  }

  await withLock(async () => {
    if (active && profileExists(active) && options.save !== false) {
      const activeDir = getProfileDir(active);
      moveItemsToProfile(activeDir);
      saveFiles(activeDir);
      moveDirsToProfile(activeDir);
      updateSettingsPaths(activeDir, 'save');
      info(`Saved current state to "${active}"`);
    }

    removeItems();
    removeFiles();

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

    if (active) setPrevious(active);
    setActive(name);

    success(`Switched to profile "${name}"`);
    info('Restart your Claude Code session to apply changes.');
  });
};
