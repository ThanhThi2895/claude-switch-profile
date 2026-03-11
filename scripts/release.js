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

const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
const runQuiet = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim();

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
    console.error('✗ Working tree is not clean. Commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }
};

const checkOnMainBranch = () => {
  const branch = runQuiet('git branch --show-current');
  if (branch !== 'main' && branch !== 'master') {
    console.error(`✗ Must be on main/master branch. Current: ${branch}`);
    process.exit(1);
  }
};

const checkNpmAuth = () => {
  try {
    runQuiet('npm whoami');
  } catch {
    console.error('✗ Not logged in to npm. Run "npm login" first.');
    process.exit(1);
  }
};

// --- Main ---

const main = () => {
  const type = process.argv[2] || 'patch';
  if (!['patch', 'minor', 'major'].includes(type)) {
    console.error(`✗ Invalid bump type: "${type}". Use patch, minor, or major.`);
    process.exit(1);
  }

  // Pre-flight checks
  console.log('Pre-flight checks...');
  checkCleanWorkingTree();
  checkOnMainBranch();
  checkNpmAuth();
  console.log('✓ All checks passed\n');

  // Read current version
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, type);

  console.log(`Bumping version: ${oldVersion} → ${newVersion} (${type})\n`);

  // Run tests
  console.log('Running tests...');
  run('npm test');
  console.log('✓ Tests passed\n');

  // Update package.json version
  pkg.version = newVersion;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✓ Updated package.json to ${newVersion}`);

  // Git commit + tag
  run('git add package.json');
  run(`git commit -m "chore(release): v${newVersion}"`);
  run(`git tag -a v${newVersion} -m "v${newVersion}"`);
  console.log(`✓ Created tag v${newVersion}`);

  // Publish to npm
  console.log('\nPublishing to npm...');
  run('npm publish');
  console.log(`✓ Published claude-switch-profile@${newVersion}`);

  // Push to remote
  run('git push && git push --tags');
  console.log(`✓ Pushed to remote with tags\n`);

  console.log(`🎉 Released v${newVersion} successfully!`);
};

main();
