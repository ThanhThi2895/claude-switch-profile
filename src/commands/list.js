import chalk from 'chalk';
import { readProfiles, getActive } from '../profile-store.js';
import { info } from '../output-helpers.js';

export const listCommand = () => {
  const profiles = readProfiles();
  const active = getActive();
  const names = Object.keys(profiles);

  if (names.length === 0) {
    info('No profiles found. Run "csp create <name>" to create one.');
    return;
  }

  console.log('');
  for (const name of names) {
    const meta = profiles[name];
    const isActive = name === active;
    const marker = isActive ? chalk.green(' * ') : '   ';
    const label = isActive ? chalk.green.bold(name) : name;
    const desc = meta.description ? chalk.dim(` — ${meta.description}`) : '';
    const date = meta.created ? chalk.dim(` (${meta.created.split('T')[0]})`) : '';
    const mode = meta.mode ? chalk.dim(` [${meta.mode}]`) : '';
    console.log(`${marker}${label}${desc}${date}${mode}`);
  }
  console.log('');
};
