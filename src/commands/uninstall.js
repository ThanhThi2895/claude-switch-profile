import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { success, info, warn } from '../output-helpers.js';

const METHODS = ['npm', 'brew', 'standalone'];

const confirm = (question) => {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
};

const normalizeMethod = (method) => {
  const normalized = (method || '').toLowerCase();
  if (!normalized) return null;
  return METHODS.includes(normalized) ? normalized : null;
};

const printMethodHint = (method) => {
  if (method === 'npm') {
    info('Run this command to uninstall csp:');
    info('  npm uninstall -g claude-switch-profile');
    return;
  }
  if (method === 'brew') {
    info('Run this command to uninstall csp:');
    info('  brew uninstall claude-switch-profile');
    return;
  }

  info('Removed standalone install artifacts:');
  info('  ~/.local/bin/csp');
  info('  ~/.csp-cli');
};

const uninstallStandalone = () => {
  const home = process.env.CSP_HOME || homedir();
  const binDir = process.env.CSP_STANDALONE_BIN_DIR || join(home, '.local', 'bin');

  rmSync(join(binDir, 'csp'), { force: true });
  rmSync(join(home, '.csp-cli'), { recursive: true, force: true });
};

export const uninstallCommand = async (options) => {
  const method = normalizeMethod(options.method);

  if (!method) {
    warn('Missing or invalid --method. Use one of: npm, brew, standalone');
    return;
  }

  console.log('');
  info('This will uninstall csp CLI only.');
  info('Profiles are kept at ~/.claude-profiles (no data is removed).');
  info(`Method: ${method}`);
  console.log('');

  if (!options.force) {
    const confirmed = await confirm(`Proceed uninstall for method "${method}"? (y/N) `);
    if (!confirmed) {
      warn('Cancelled.');
      return;
    }
  }

  if (method === 'standalone') {
    uninstallStandalone();
    success('Standalone csp uninstall completed.');
    printMethodHint(method);
    return;
  }

  if (!existsSync(join(process.env.CSP_HOME || homedir(), '.claude-profiles'))) {
    info('No profiles directory found.');
  }

  success('csp uninstall instructions are ready.');
  printMethodHint(method);
};
