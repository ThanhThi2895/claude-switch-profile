import {
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  lstatSync,
  statSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  readlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { MANAGED_ITEMS, COPY_ITEMS, COPY_DIRS, CLAUDE_DIR, DEFAULT_PROFILE } from './constants.js';
import {
  getActive,
  getProfileDir,
  getProfileMeta,
  getRuntimeDir,
  markRuntimeInitialized,
  markProfileLaunched,
} from './profile-store.js';

const removePath = (targetPath) => {
  if (!existsSync(targetPath)) return;
  rmSync(targetPath, { recursive: true, force: true });
};

const shouldSyncDir = (src, dest) => {
  if (!existsSync(dest)) return true;

  try {
    const pending = [[src, dest]];

    while (pending.length > 0) {
      const [srcDir, destDir] = pending.pop();
      const srcEntries = readdirSync(srcDir, { withFileTypes: true });
      const destEntries = readdirSync(destDir, { withFileTypes: true });

      if (srcEntries.length !== destEntries.length) return true;

      const destMap = new Map(destEntries.map((entry) => [entry.name, entry]));

      for (const srcEntry of srcEntries) {
        const destEntry = destMap.get(srcEntry.name);
        if (!destEntry) return true;

        const srcPath = join(srcDir, srcEntry.name);
        const destPath = join(destDir, srcEntry.name);

        if (srcEntry.isSymbolicLink()) {
          if (!destEntry.isSymbolicLink()) return true;
          if (readlinkSync(srcPath) !== readlinkSync(destPath)) return true;
          continue;
        }

        if (srcEntry.isDirectory()) {
          if (!destEntry.isDirectory()) return true;
          pending.push([srcPath, destPath]);
          continue;
        }

        if (srcEntry.isFile()) {
          if (!destEntry.isFile()) return true;
          const srcStat = statSync(srcPath);
          const destStat = statSync(destPath);
          if (srcStat.size !== destStat.size) return true;
          if (srcStat.mtimeMs !== destStat.mtimeMs) return true;
        }
      }
    }

    return false;
  } catch {
    return true;
  }
};

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replacePathVariants = (content, fromPath, toPath) => {
  const fromEscaped = fromPath.replaceAll('\\', '\\\\');
  const toEscaped = toPath.replaceAll('\\', '\\\\');
  const fromFwd = fromPath.replaceAll('\\', '/');
  const toFwd = toPath.replaceAll('\\', '/');

  let updated = content;

  // Prevent matching substrings of other paths (e.g. ~/.claude matching ~/.claude-profiles)
  // by ensuring it's not immediately followed by an alphanumeric character or hyphen.
  const negativeLookahead = '(?![a-zA-Z0-9\\-])';

  const replaceWithRegex = (str, targetF, targetT) => {
    const re = new RegExp(escapeRegExp(targetF) + negativeLookahead, 'g');
    return str.replace(re, targetT);
  };

  updated = replaceWithRegex(updated, fromEscaped, toEscaped);
  updated = replaceWithRegex(updated, fromFwd, toFwd);
  if (fromPath !== fromEscaped) {
    updated = replaceWithRegex(updated, fromPath, toPath);
  }

  return updated;
};

const rewriteSettingsForRuntime = (runtimeDir, sourceDir) => {
  const settingsPath = join(runtimeDir, 'settings.json');
  if (!existsSync(settingsPath)) return;

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    let updated = raw;

    updated = replacePathVariants(updated, sourceDir, runtimeDir);
    updated = replacePathVariants(updated, CLAUDE_DIR, runtimeDir);

    // Also replace shell variable patterns commonly used in hook commands.
    // Hook commands in settings.json often reference paths like:
    //   $HOME/.claude/hooks/...  or  ${HOME}/.claude/hooks/...  or  ~/.claude/hooks/...
    // These won't match the literal path replacement above.
    const home = homedir();
    const claudeRelSuffix = CLAUDE_DIR.startsWith(home) ? CLAUDE_DIR.slice(home.length) : '/.claude';

    const shellPatterns = [
      `$HOME${claudeRelSuffix}`,
      `\${HOME}${claudeRelSuffix}`,
      `~${claudeRelSuffix}`,
    ];

    for (const pattern of shellPatterns) {
      if (updated.includes(pattern)) {
        updated = updated.replaceAll(pattern, runtimeDir);
      }
    }

    if (updated !== raw) {
      writeFileSync(settingsPath, updated);
    }
  } catch {
    // Best effort
  }
};

const getStaticItems = () => {
  return [...new Set([...MANAGED_ITEMS, ...COPY_ITEMS, ...COPY_DIRS])];
};

const shouldUseLiveClaudeDir = (profileName) => {
  return profileName === DEFAULT_PROFILE && getActive() === profileName;
};

const resolveSourceDir = (profileName) => {
  return shouldUseLiveClaudeDir(profileName) ? CLAUDE_DIR : getProfileDir(profileName);
};

const resolveItemSource = (profileName, item) => {
  const profileDir = getProfileDir(profileName);

  if (shouldUseLiveClaudeDir(profileName)) {
    const claudePath = join(CLAUDE_DIR, item);
    if (existsSync(claudePath)) return claudePath;
  }

  const profilePath = join(profileDir, item);
  if (existsSync(profilePath)) return profilePath;

  return null;
};

export const syncStaticConfig = (profileName, runtimeDir) => {
  const sourceDir = resolveSourceDir(profileName);
  const staticItems = getStaticItems();

  mkdirSync(runtimeDir, { recursive: true });

  for (const item of staticItems) {
    const src = resolveItemSource(profileName, item);
    const dest = join(runtimeDir, item);

    if (!src) {
      continue;
    }

    const stat = lstatSync(src);

    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      if (!shouldSyncDir(src, dest)) continue;
    }

    removePath(dest);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
  }

  rewriteSettingsForRuntime(runtimeDir, sourceDir);

  return { runtimeDir, sourceDir };
};

export const seedRuntimeIfNeeded = (profileName) => {
  const meta = getProfileMeta(profileName);
  const runtimeDir = meta?.runtimeDir || getRuntimeDir(profileName);

  syncStaticConfig(profileName, runtimeDir);

  if (!meta || !meta.runtimeInitializedAt || meta.runtimeDir !== runtimeDir) {
    markRuntimeInitialized(profileName, runtimeDir);
  } else {
    markProfileLaunched(profileName);
  }

  return runtimeDir;
};

export const ensureRuntimeInstance = (profileName) => {
  return seedRuntimeIfNeeded(profileName);
};
