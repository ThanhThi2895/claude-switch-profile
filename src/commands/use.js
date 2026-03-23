import { getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveItems, removeItems, restoreItems } from '../item-manager.js';
import { saveFiles, removeFiles, restoreFiles, updateSettingsPaths } from '../file-operations.js';
import { validateProfile } from '../profile-validator.js';
import { withLock, warnIfClaudeRunning } from '../safety.js';
import { success, error, info, warn } from '../output-helpers.js';
import { CLAUDE_DIR } from '../constants.js';

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

  // Validate target profile
  const validation = validateProfile(profileDir);
  if (!validation.valid) {
    error(`Profile "${name}" is invalid:`);
    validation.errors.forEach((e) => error(`  ${e}`));
    process.exit(1);
  }

  if (options.dryRun) {
    info(`[Dry run] Would switch from "${active || 'none'}" to "${name}"`);
    info(`[Dry run] Profile dir: ${profileDir}`);
    return;
  }

  if (!options.skipClaudeCheck) warnIfClaudeRunning();

  await withLock(async () => {
    // 1. Save current state to active profile (if any)
    if (active && profileExists(active) && options.save !== false) {
      const activeDir = getProfileDir(active);
      saveItems(activeDir);
      saveFiles(activeDir);
      updateSettingsPaths(activeDir, 'save');
      info(`Saved current state to "${active}"`);
    }

    // 2. Remove managed items + restore target
    removeItems();
    removeFiles();

    try {
      restoreItems(profileDir);
      restoreFiles(profileDir);
      // Update paths in restored ~/.claude/settings.json (profileDir → CLAUDE_DIR)
      updateSettingsPaths(CLAUDE_DIR, 'restore', profileDir);
    } catch (err) {
      warn(`Switch failed: ${err.message}`);
      error('Manual recovery: re-run "csp use <profile>" or restore from profile directory.');
      throw err;
    }

    // 3. Update active marker
    setActive(name);

    success(`Switched to profile "${name}"`);
    info('Restart your Claude Code session to apply changes.');
  });
};
