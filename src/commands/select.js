import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { readProfiles, getActive } from '../profile-store.js';
import { PROFILES_DIR } from '../constants.js';
import { existsSync } from 'node:fs';
import { launchCommand } from './launch.js';
import { info, error } from '../output-helpers.js';

const renderMenu = (names, profiles, active, selected) => {
  // Move cursor up to overwrite previous render (except first render)
  const lines = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const meta = profiles[name];
    const isActive = name === active;
    const isSelected = i === selected;

    const cursor = isSelected ? chalk.cyan('❯ ') : '  ';
    const label = isSelected ? chalk.cyan.bold(name) : isActive ? chalk.green(name) : name;
    const activeTag = isActive ? chalk.green(' (active)') : '';
    const desc = meta.description ? chalk.dim(` — ${meta.description}`) : '';
    lines.push(`${cursor}${label}${activeTag}${desc}`);
  }
  return lines;
};

export const selectCommand = async () => {
  if (!existsSync(PROFILES_DIR)) {
    error('CSP not initialized. Run "csp init" to start.');
    process.exit(1);
  }

  const profiles = readProfiles();
  const active = getActive();
  const names = Object.keys(profiles);

  if (names.length === 0) {
    info('No profiles found. Run "csp create <name>" to create one.');
    return;
  }

  if (names.length === 1) {
    info(`Only one profile: "${names[0]}". Nothing to switch to.`);
    return;
  }

  // Non-TTY: fall back to list
  if (!process.stdin.isTTY) {
    info('Non-interactive terminal. Use "csp launch <name>" or "csp use <name>" directly.');
    process.exit(1);
  }

  let selected = active ? Math.max(names.indexOf(active), 0) : 0;

  console.log('');
  console.log(chalk.bold('Select profile to launch:'));
  console.log(chalk.dim('(↑/↓ navigate, Enter select, Esc cancel)'));
  console.log('');

  // Initial render
  const menuLines = renderMenu(names, profiles, active, selected);
  for (const line of menuLines) {
    process.stdout.write(line + '\n');
  }

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin });

    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const redraw = () => {
      // Move up N lines and clear
      process.stdout.write(`\x1b[${names.length}A`);
      const lines = renderMenu(names, profiles, active, selected);
      for (const line of lines) {
        process.stdout.write(`\x1b[2K${line}\n`);
      }
    };

    const cleanup = () => {
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      rl.close();
    };

    process.stdin.on('data', async (data) => {
      const key = data.toString();

      // Escape or Ctrl+C
      if (key === '\x1b' || key === '\x03') {
        cleanup();
        console.log(chalk.dim('\nCancelled.'));
        resolve();
        return;
      }

      // Up arrow
      if (key === '\x1b[A' || key === 'k') {
        selected = (selected - 1 + names.length) % names.length;
        redraw();
        return;
      }

      // Down arrow
      if (key === '\x1b[B' || key === 'j') {
        selected = (selected + 1) % names.length;
        redraw();
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        cleanup();
        const chosen = names[selected];
        console.log('');
        await launchCommand(chosen, [], {});
        resolve();
        return;
      }
    });
  });
};
