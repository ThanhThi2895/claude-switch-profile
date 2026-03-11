import { getActive, setActive, profileExists, getProfileDir } from '../profile-store.js';
import { saveSymlinks, removeSymlinks, restoreSymlinks, createSymlinks } from '../symlink-manager.js';
import { saveFiles, removeFiles, restoreFiles } from '../file-operations.js';
import { validateProfile, validateSourceTargets } from '../profile-validator.js';
import { withLock, warnIfClaudeRunning, createBackup } from '../safety.js';
import { success, error, info, warn } from '../output-helpers.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_FILE } from '../constants.js';

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

  // Validate symlink targets exist
  const sourcePath = join(profileDir, SOURCE_FILE);
  try {
    const sourceMap = JSON.parse(readFileSync(sourcePath, 'utf-8'));
    const targetValidation = validateSourceTargets(sourceMap);
    if (!targetValidation.valid) {
      warn('Some symlink targets are missing:');
      targetValidation.errors.forEach((e) => warn(`  ${e}`));
      if (!options.force) {
        error('Use --force to switch anyway.');
        process.exit(1);
      }
    }
  } catch {
    // source.json parse error — will be caught during restore
  }

  if (options.dryRun) {
    info(`[Dry run] Would switch from "${active || 'none'}" to "${name}"`);
    info(`[Dry run] Profile dir: ${profileDir}`);
    return;
  }

  warnIfClaudeRunning();

  await withLock(async () => {
    // 1. Save current state to active profile (if any)
    if (active && profileExists(active) && options.save !== false) {
      const activeDir = getProfileDir(active);
      saveSymlinks(activeDir);
      saveFiles(activeDir);
      info(`Saved current state to "${active}"`);
    }

    // 2. Auto-backup
    const backupPath = createBackup();
    info(`Backup created at ${backupPath}`);

    // 3. Remove managed items + restore target — with rollback on failure
    removeSymlinks();
    removeFiles();

    try {
      restoreSymlinks(profileDir);
      restoreFiles(profileDir);
    } catch (err) {
      // Rollback: restore from backup
      warn('Switch failed — rolling back from backup...');
      try {
        const backupSource = join(backupPath, SOURCE_FILE);
        if (existsSync(backupSource)) {
          const backupMap = JSON.parse(readFileSync(backupSource, 'utf-8'));
          createSymlinks(backupMap);
        }
        restoreFiles(backupPath);
        warn('Rollback complete. Previous config restored.');
      } catch (rollbackErr) {
        error(`Rollback also failed: ${rollbackErr.message}`);
        error(`Manual recovery: restore from ${backupPath}`);
      }
      throw err;
    }

    // 4. Update active marker
    setActive(name);

    success(`Switched to profile "${name}"`);
    info('Restart your Claude Code session to apply changes.');
  });
};
