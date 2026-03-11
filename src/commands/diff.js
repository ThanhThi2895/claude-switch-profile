import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { profileExists, getProfileDir, getActive } from '../profile-store.js';
import { SOURCE_FILE } from '../constants.js';
import { error, info } from '../output-helpers.js';

export const diffCommand = (profileA, profileB) => {
  // Resolve "current" alias
  const resolveProfile = (name) => {
    if (name === 'current') {
      const active = getActive();
      if (!active) {
        error('No active profile to use as "current".');
        process.exit(1);
      }
      return active;
    }
    return name;
  };

  const nameA = resolveProfile(profileA);
  const nameB = resolveProfile(profileB);

  if (!profileExists(nameA)) {
    error(`Profile "${nameA}" does not exist.`);
    process.exit(1);
  }
  if (!profileExists(nameB)) {
    error(`Profile "${nameB}" does not exist.`);
    process.exit(1);
  }

  const dirA = getProfileDir(nameA);
  const dirB = getProfileDir(nameB);

  console.log(`\n${chalk.bold('Comparing:')} ${chalk.cyan(nameA)} ↔ ${chalk.cyan(nameB)}\n`);

  // Compare source.json (symlink targets)
  const sourceA = readJsonSafe(join(dirA, SOURCE_FILE));
  const sourceB = readJsonSafe(join(dirB, SOURCE_FILE));
  diffObject('Symlink targets (source.json)', sourceA, sourceB, nameA, nameB);

  // Compare files that exist in either profile
  const filesA = new Set(readdirSync(dirA).filter((f) => f !== SOURCE_FILE));
  const filesB = new Set(readdirSync(dirB).filter((f) => f !== SOURCE_FILE));

  const allFiles = new Set([...filesA, ...filesB]);
  const diffs = [];

  for (const file of allFiles) {
    const inA = filesA.has(file);
    const inB = filesB.has(file);

    if (inA && !inB) {
      diffs.push({ file, status: `only in ${nameA}` });
    } else if (!inA && inB) {
      diffs.push({ file, status: `only in ${nameB}` });
    } else {
      // Both exist — compare content for regular files
      const pathA = join(dirA, file);
      const pathB = join(dirB, file);
      try {
        const contentA = readFileSync(pathA, 'utf-8');
        const contentB = readFileSync(pathB, 'utf-8');
        if (contentA !== contentB) {
          diffs.push({ file, status: 'different' });
        }
      } catch {
        diffs.push({ file, status: 'could not compare (directory?)' });
      }
    }
  }

  if (diffs.length === 0) {
    info('Profiles are identical (excluding symlink targets).');
  } else {
    console.log(chalk.bold('File differences:'));
    for (const d of diffs) {
      const color = d.status === 'different' ? chalk.yellow : chalk.dim;
      console.log(`  ${color(d.file)} — ${d.status}`);
    }
  }

  console.log('');
};

const readJsonSafe = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
};

const diffObject = (label, objA, objB, nameA, nameB) => {
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  const diffs = [];

  for (const key of allKeys) {
    const valA = objA[key];
    const valB = objB[key];
    if (valA !== valB) {
      diffs.push({ key, a: valA || '(none)', b: valB || '(none)' });
    }
  }

  if (diffs.length === 0) {
    info(`${label}: identical`);
    return;
  }

  console.log(chalk.bold(`${label}:`));
  for (const d of diffs) {
    console.log(`  ${chalk.dim(d.key)}:`);
    console.log(`    ${chalk.red(`${nameA}:`)} ${d.a}`);
    console.log(`    ${chalk.green(`${nameB}:`)} ${d.b}`);
  }
};
