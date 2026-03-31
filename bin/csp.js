#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { currentCommand } from '../src/commands/current.js';
import { listCommand } from '../src/commands/list.js';
import { createCommand } from '../src/commands/create.js';
import { saveCommand } from '../src/commands/save.js';
import { useCommand } from '../src/commands/use.js';
import { deleteCommand } from '../src/commands/delete.js';
import { exportCommand } from '../src/commands/export.js';
import { importCommand } from '../src/commands/import.js';
import { diffCommand } from '../src/commands/diff.js';
import { initCommand } from '../src/commands/init.js';
import { uninstallCommand } from '../src/commands/uninstall.js';
import { launchCommand, execCommand } from '../src/commands/launch.js';
import { deactivateCommand } from '../src/commands/deactivate.js';
import { toggleCommand } from '../src/commands/toggle.js';
import { statusCommand } from '../src/commands/status.js';
import { selectCommand } from '../src/commands/select.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('csp')
  .description('Claude Switch Profile — manage multiple Claude Code configurations')
  .version(pkg.version)
  .enablePositionalOptions();

program
  .command('select', { isDefault: true })
  .description('Interactive profile selector (default when no command given)')
  .action(selectCommand);

program
  .command('init')
  .description('Initialize profiles directory and create default profile')
  .action(initCommand);

program
  .command('current')
  .description('Show the active legacy profile and isolated launch metadata')
  .action(currentCommand);

program
  .command('list')
  .alias('ls')
  .description('List all profiles')
  .action(listCommand);

program
  .command('status')
  .description('Show CSP status dashboard')
  .action(statusCommand);

program
  .command('create <name>')
  .description('Create a new profile from current Claude Code state')
  .option('--from <profile>', 'Clone from an existing profile')
  .option('-s, --source <path>', 'Path to .agents/ or kit directory to link')
  .option('-d, --description <text>', 'Profile description')
  .action(createCommand);

program
  .command('save')
  .description('Save current state to the active profile')
  .action(saveCommand);

program
  .command('use <name>')
  .description('Switch to a different profile')
  .option('--dry-run', 'Show what would change without executing')
  .option('--no-save', 'Skip saving current profile before switching')
  .action(useCommand);

program
  .command('toggle')
  .description('Switch to the previous profile')
  .action(toggleCommand);

program
  .command('delete <name>')
  .alias('rm')
  .description('Delete a profile')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(deleteCommand);

program
  .command('export <name>')
  .description('Export a profile as tar.gz archive')
  .option('-o, --output <path>', 'Output file path')
  .action(exportCommand);

program
  .command('import <file>')
  .description('Import a profile from tar.gz archive')
  .option('-n, --name <name>', 'Profile name (defaults to filename)')
  .option('-d, --description <text>', 'Profile description')
  .action(importCommand);

program
  .command('diff <profileA> <profileB>')
  .description('Compare two profiles (use "current" for active profile)')
  .action(diffCommand);

program
  .command('deactivate')
  .description('Deactivate the current profile (remove managed items from ~/.claude)')
  .option('--no-save', 'Skip saving current profile before deactivating')
  .action(deactivateCommand);

program
  .command('launch <name> [args...]')
  .alias('la')
  .description('Launch isolated Claude session for a profile (use --legacy-global for old switch+launch behavior)')
  .option('--legacy-global', 'Use legacy global switch path before launching Claude')
  .allowUnknownOption(true)
  .enablePositionalOptions(true)
  .passThroughOptions(true)
  .action((name, args, options, cmd) => {
    // Merge explicit positional args with unknown options (e.g. --dangerously-skip-permissions)
    const unknownOpts = cmd.args.filter((a) => a !== name && !args.includes(a));
    const claudeArgs = [...args, ...unknownOpts];
    launchCommand(name, claudeArgs, options);
  });

program
  .command('exec <name> [args...]')
  .description('Run arbitrary command inside isolated profile runtime environment')
  .allowUnknownOption(true)
  .enablePositionalOptions(true)
  .passThroughOptions(true)
  .action((name, args, _options, cmd) => {
    const passthrough = [...(args || [])];
    const unknown = cmd.args.filter((a) => a !== name && !passthrough.includes(a));
    const tokens = [...passthrough, ...unknown];

    while (tokens[0] === '--') {
      tokens.shift();
    }

    const command = tokens[0];
    const commandArgs = tokens.slice(1);
    execCommand(name, command, commandArgs);
  });

program
  .command('uninstall')
  .description('Remove all profiles and restore Claude Code to pre-CSP state')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--profile <name>', 'Restore specific profile instead of active one')
  .action(uninstallCommand);

program.parse();
