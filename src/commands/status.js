import chalk from 'chalk';
import { readProfiles, getActive } from '../profile-store.js';
import { isClaudeRunning } from '../safety.js';
import { PROFILES_DIR } from '../constants.js';
import { existsSync } from 'node:fs';

export const statusCommand = () => {
  if (!existsSync(PROFILES_DIR)) {
    console.log(chalk.yellow('CSP not initialized. Run "csp init" to start.'));
    return;
  }

  const profiles = readProfiles();
  const active = getActive();
  const names = Object.keys(profiles);
  const claudeRunning = isClaudeRunning();

  console.log('');
  console.log(chalk.bold('Claude Switch Profile'));
  console.log(chalk.dim('─'.repeat(40)));

  // Active profile
  if (active) {
    console.log(`  ${chalk.bold('Active:')}   ${chalk.green(active)}`);
  } else {
    console.log(`  ${chalk.bold('Active:')}   ${chalk.dim('none')}`);
  }

  // Profile count
  console.log(`  ${chalk.bold('Profiles:')} ${names.length} (${names.join(', ')})`);

  // Last launch info
  const launched = names
    .filter((n) => profiles[n].lastLaunchAt)
    .sort((a, b) => (profiles[b].lastLaunchAt || '').localeCompare(profiles[a].lastLaunchAt || ''));
  if (launched.length > 0) {
    const last = launched[0];
    const ts = profiles[last].lastLaunchAt.split('T')[0];
    console.log(`  ${chalk.bold('Last launch:')} ${last} (${ts})`);
  }

  // Claude running
  const runIcon = claudeRunning ? chalk.yellow('⚠ running') : chalk.green('not running');
  console.log(`  ${chalk.bold('Claude:')}   ${runIcon}`);

  console.log(chalk.dim('─'.repeat(40)));
  console.log('');
};
