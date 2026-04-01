#!/usr/bin/env node

/**
 * Release script for claude-switch-profile (csp)
 * Usage: node scripts/release.js [patch|minor|major]
 * Default: patch
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PKG_PATH = join(ROOT, 'package.json');
const TEST_SUMMARY_PATTERN = /^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/;

const run = (cmd, options = {}) => {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: 'inherit',
    ...options,
  });
};

const runQuiet = (cmd) => run(cmd, { stdio: 'pipe' }).trim();

const fail = (message, details = '') => {
  console.error(`✗ ${message}`);
  if (details) console.error(details);
  process.exit(1);
};

const formatCommandOutput = (error) => {
  const stdout = error?.stdout?.toString?.() || '';
  const stderr = error?.stderr?.toString?.() || '';
  return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
};

const printTestSummary = (output) => {
  const summary = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => TEST_SUMMARY_PATTERN.test(line))
    .map((line) => line.replace(/^#\s*/, ''))
    .join('\n');

  if (summary) console.log(summary);
};

// --- Helpers ---

const bumpVersion = (current, type) => {
  const [major, minor, patch] = current.split('.').map(Number);
  const bumps = {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  };
  return bumps[type] || bumps.patch;
};

const checkCleanWorkingTree = () => {
  const status = runQuiet('git status --porcelain');
  if (status) {
    fail('Working tree is not clean. Commit or stash changes first.', status);
  }
};

const checkOnMainBranch = () => {
  const branch = runQuiet('git branch --show-current');
  if (branch !== 'main' && branch !== 'master') {
    fail(`Must be on main/master branch. Current: ${branch}`);
  }
};

const checkNpmAuth = () => {
  try {
    runQuiet('npm whoami');
  } catch {
    fail('Not logged in to npm. Run "npm login" first.');
  }
};

const runTests = () => {
  console.log('Running tests...');

  try {
    const output = run('npm test', { stdio: 'pipe' });
    printTestSummary(output);
    console.log('✓ Tests passed\n');
  } catch (error) {
    const output = formatCommandOutput(error);
    fail('Tests failed. Release aborted.', output);
  }
};

// --- Main ---

const main = () => {
  const type = process.argv[2] || 'patch';
  if (!['patch', 'minor', 'major'].includes(type)) {
    fail(`Invalid bump type: "${type}". Use patch, minor, or major.`);
  }

  console.log('Pre-flight checks...');
  checkCleanWorkingTree();
  checkOnMainBranch();
  checkNpmAuth();
  console.log('✓ All checks passed\n');

  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, type);

  console.log(`Bumping version: ${oldVersion} → ${newVersion} (${type})\n`);

  runTests();

  pkg.version = newVersion;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated package.json to ${newVersion}`);

  run('git add package.json');
  run(`git commit -m "chore(release): v${newVersion}"`);

  console.log('\nPublishing to npm...');
  run('npm publish');
  console.log(`✓ Published claude-switch-profile@${newVersion}`);

  run('git push');
  console.log('✓ Pushed release commit to remote\n');

  console.log(`🎉 Published claude-switch-profile@${newVersion} and pushed release commit successfully!`);
};

try {
  main();
} catch (error) {
  fail('Release failed.', formatCommandOutput(error));
}
