import { getActive, clearActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveItems, removeItems } from '../item-manager.js';
import { saveFiles, removeFiles } from '../file-operations.js';
import { withLock, warnIfClaudeRunning } from '../safety.js';
import { success, error, info } from '../output-helpers.js';

export const deactivateCommand = async (options) => {
  const active = getActive();
  if (!active) {
    info('No active profile to deactivate.');
    return;
  }

  if (!options.skipClaudeCheck) warnIfClaudeRunning();

  await withLock(async () => {
    // Save current state before deactivating (unless --no-save)
    if (profileExists(active) && options.save !== false) {
      const activeDir = getProfileDir(active);
      saveItems(activeDir);
      saveFiles(activeDir);
      info(`Saved current state to "${active}"`);
    }

    // Remove all managed items from ~/.claude
    removeItems();
    removeFiles();

    // Clear active marker
    clearActive();

    success(`Profile "${active}" deactivated.`);
    info('Restart your Claude Code session to apply changes.');
  });
};
