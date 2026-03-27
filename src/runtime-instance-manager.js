import { existsSync, mkdirSync, cpSync, rmSync, lstatSync, statSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

const replacePathVariants = (content, fromPath, toPath) => {
  const fromEscaped = fromPath.replaceAll('\\', '\\\\');
  const toEscaped = toPath.replaceAll('\\', '\\\\');
  const fromFwd = fromPath.replaceAll('\\', '/');
  const toFwd = toPath.replaceAll('\\', '/');

  let updated = content;
  updated = updated.replaceAll(fromEscaped, toEscaped);
  updated = updated.replaceAll(fromFwd, toFwd);
  if (fromPath !== fromEscaped) {
    updated = updated.replaceAll(fromPath, toPath);
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

const resolveSourceDir = (profileName) => {
  if (profileName === DEFAULT_PROFILE) {
    return CLAUDE_DIR;
  }

  const active = getActive();
  if (active === profileName) {
    return CLAUDE_DIR;
  }

  return getProfileDir(profileName);
};

const resolveItemSource = (profileName, item) => {
  const profileDir = profileName === DEFAULT_PROFILE ? null : getProfileDir(profileName);
  const active = getActive();
  const profileIsActive = active === profileName;

  // When profile is active or default, items live in CLAUDE_DIR
  if (profileIsActive || profileName === DEFAULT_PROFILE) {
    const claudePath = join(CLAUDE_DIR, item);
    if (existsSync(claudePath)) return claudePath;
    // Fallback: items may still be in profileDir (not yet moved by `use`)
    if (profileDir) {
      const profilePath = join(profileDir, item);
      if (existsSync(profilePath)) return profilePath;
    }
    return null;
  }

  // Profile is NOT active — items should be in profileDir
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
      // Source doesn't exist anywhere — skip (don't delete existing runtime items)
      continue;
    }

    const stat = lstatSync(src);

    if (stat.isDirectory()) {
      if (!shouldSyncDir(src, dest)) continue;
      removePath(dest);
      cpSync(src, dest, { recursive: true });
      continue;
    }

    if (stat.isFile()) {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
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
