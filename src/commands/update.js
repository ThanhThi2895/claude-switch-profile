import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { success, info, warn, error } from '../output-helpers.js';

const METHODS = ['npm', 'brew', 'standalone'];
const STANDALONE_INSTALL_URL = 'https://raw.githubusercontent.com/ThanhThi2895/claude-switch-profile/main/install.sh';
const modulePath = fileURLToPath(import.meta.url);
const __dirname = dirname(modulePath);
const INSTALL_SCRIPT = join(__dirname, '..', '..', 'install.sh');
const TEST_DRY_RUN = process.env.NODE_ENV === 'test' || process.env.CSP_UPDATE_DRY_RUN === '1';

const confirm = (question) => new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => {
    rl.close();
    resolve(answer.toLowerCase().startsWith('y'));
  });
});

const normalizeMethod = (method) => {
  const normalized = (method || '').toLowerCase();
  if (!normalized) return null;
  return METHODS.includes(normalized) ? normalized : null;
};

const detectInstallMethod = () => {
  const normalizedPath = modulePath.replaceAll('\\', '/').toLowerCase();
  const normalizedHome = homedir().replaceAll('\\', '/').toLowerCase();

  if (normalizedPath.includes(`${normalizedHome}/.csp-cli/`)) return 'standalone';
  if (normalizedPath.includes('/cellar/claude-switch-profile/')) return 'brew';
  return 'npm';
};

const runCommand = ({ command, args, label }) => {
  const rendered = [command, ...args].join(' ');

  if (TEST_DRY_RUN) {
    info(`${label} (dry run in test mode):`);
    info(`  ${rendered}`);
    return true;
  }

  const result = spawnSync(command, args, { stdio: 'inherit' });

  if (result.error) {
    error(`${label} failed: ${result.error.message}`);
    process.exitCode = 1;
    return false;
  }

  if (result.status !== 0) {
    error(`${label} failed.`);
    process.exitCode = result.status || 1;
    return false;
  }

  return true;
};

const runStandaloneUpdate = () => {
  if (existsSync(INSTALL_SCRIPT)) {
    return runCommand({ command: 'bash', args: [INSTALL_SCRIPT], label: 'Standalone update' });
  }

  return runCommand({
    command: 'bash',
    args: ['-lc', `curl -fsSL ${STANDALONE_INSTALL_URL} | bash`],
    label: 'Standalone update',
  });
};

export const updateCommand = async (options = {}) => {
  const hasExplicitMethod = typeof options.method === 'string' && options.method.length > 0;
  const method = hasExplicitMethod ? normalizeMethod(options.method) : detectInstallMethod();

  if (hasExplicitMethod && !method) {
    warn('Missing or invalid --method. Use one of: npm, brew, standalone');
    process.exitCode = 1;
    return;
  }

  console.log('');
  info('This updates the csp CLI only.');
  info('Profiles are kept at ~/.claude-profiles (no data is removed).');
  info(`Method: ${method}${hasExplicitMethod ? '' : ' (auto-detected; override with --method)'}`);
  console.log('');

  if (!options.force) {
    const confirmed = await confirm(`Proceed update for method "${method}"? (y/N) `);
    if (!confirmed) {
      warn('Cancelled.');
      return;
    }
  }

  if (method === 'standalone') {
    if (runStandaloneUpdate()) success('csp update completed.');
    return;
  }

  if (method === 'brew') {
    if (runCommand({ command: 'brew', args: ['upgrade', 'claude-switch-profile'], label: 'Homebrew update' })) {
      success('csp update completed.');
    }
    return;
  }

  if (runCommand({ command: 'npm', args: ['install', '-g', 'claude-switch-profile@latest'], label: 'npm update' })) {
    success('csp update completed.');
  }
};
