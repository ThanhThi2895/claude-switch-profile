import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { profileExists, getActive, getEffectiveDir, getProfileDir } from '../profile-store.js';
import { SOURCE_FILE, ALL_MANAGED } from '../constants.js';
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

  const dirA = getEffectiveDir(nameA);
  const dirB = getEffectiveDir(nameB);
  const sourceDirA = join(getProfileDir(nameA), SOURCE_FILE);
  const sourceDirB = join(getProfileDir(nameB), SOURCE_FILE);

  console.log(`\n${chalk.bold('Comparing:')} ${chalk.cyan(nameA)} ↔ ${chalk.cyan(nameB)}\n`);

  // Compare source.json from stored profile dirs, not live ~/.claude state
  const sourceA = readJsonSafe(sourceDirA);
  const sourceB = readJsonSafe(sourceDirB);
  diffObject('Managed item sources (source.json)', sourceA, sourceB, nameA, nameB);

  // Compare files that exist in either profile
  // When reading from CLAUDE_DIR (active/default profile), filter to only managed items
  const active = getActive();
  const managedSet = new Set(ALL_MANAGED);
  const listManagedFiles = (dir) => {
    const all = readdirSync(dir).filter((f) => f !== SOURCE_FILE);
    if ((dir === dirA && active === nameA) || (dir === dirB && active === nameB)) {
      return new Set(all.filter((f) => managedSet.has(f)));
    }
    return new Set(all);
  };
  const filesA = listManagedFiles(dirA, nameA);
  const filesB = listManagedFiles(dirB, nameB);

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
    info('Profiles are identical (excluding source paths).');
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
