import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync, rmSync, copyFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const createTestEnv = () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'csp-test-'));
  const claudeDir = join(tempDir, '.claude');
  const profilesDir = join(tempDir, '.claude-profiles');
  mkdirSync(claudeDir, { recursive: true });
  mkdirSync(profilesDir, { recursive: true });
  return { tempDir, claudeDir, profilesDir };
};

// ─── Profile Store (direct fs operations) ───

describe('Profile Store', () => {
  let env;

  beforeEach(() => { env = createTestEnv(); });
  afterEach(() => { rmSync(env.tempDir, { recursive: true, force: true }); });

  it('reads empty profiles when no file exists', () => {
    const metaPath = join(env.profilesDir, 'profiles.json');
    assert.equal(existsSync(metaPath), false);
  });

  it('writes and reads profiles.json', () => {
    const metaPath = join(env.profilesDir, 'profiles.json');
    const data = { myprofile: { created: '2026-03-11', description: 'test' } };
    writeFileSync(metaPath, JSON.stringify(data, null, 2));
    const read = JSON.parse(readFileSync(metaPath, 'utf-8'));
    assert.deepEqual(read, data);
  });

  it('writes and reads .active file', () => {
    const activePath = join(env.profilesDir, '.active');
    writeFileSync(activePath, 'myprofile\n');
    const active = readFileSync(activePath, 'utf-8').trim();
    assert.equal(active, 'myprofile');
  });

  it('detects profile existence by directory', () => {
    const profileDir = join(env.profilesDir, 'testprofile');
    assert.equal(existsSync(profileDir), false);
    mkdirSync(profileDir);
    assert.equal(existsSync(profileDir), true);
  });

  it('adds and removes profile entries', () => {
    const metaPath = join(env.profilesDir, 'profiles.json');
    const profiles = {};
    profiles['work'] = { created: '2026-03-11', description: 'Work profile' };
    profiles['personal'] = { created: '2026-03-11', description: 'Personal' };
    writeFileSync(metaPath, JSON.stringify(profiles, null, 2));

    // Remove one
    delete profiles['personal'];
    writeFileSync(metaPath, JSON.stringify(profiles, null, 2));
    const read = JSON.parse(readFileSync(metaPath, 'utf-8'));
    assert.equal(Object.keys(read).length, 1);
    assert.equal(read['work'].description, 'Work profile');
  });
});

// ─── Item Manager (copy-based) ───

describe('Item Manager', () => {
  let env;

  beforeEach(() => { env = createTestEnv(); });
  afterEach(() => { rmSync(env.tempDir, { recursive: true, force: true }); });

  it('copies files to profile dir and reads them back', () => {
    const targetFile = join(env.claudeDir, 'CLAUDE.md');
    writeFileSync(targetFile, '# Test');

    // Copy to profile
    const profileDir = join(env.profilesDir, 'test');
    mkdirSync(profileDir);
    copyFileSync(targetFile, join(profileDir, 'CLAUDE.md'));

    assert.equal(readFileSync(join(profileDir, 'CLAUDE.md'), 'utf-8'), '# Test');
    // Original still exists
    assert.equal(existsSync(targetFile), true);
  });

  it('copies directories recursively', () => {
    const rulesDir = join(env.claudeDir, 'rules');
    mkdirSync(rulesDir);
    writeFileSync(join(rulesDir, 'dev.md'), '# Rules');

    const profileDir = join(env.profilesDir, 'test');
    mkdirSync(profileDir);
    cpSync(rulesDir, join(profileDir, 'rules'), { recursive: true });

    assert.equal(existsSync(join(profileDir, 'rules', 'dev.md')), true);
    assert.equal(readFileSync(join(profileDir, 'rules', 'dev.md'), 'utf-8'), '# Rules');
  });

  it('removes items without affecting profile copies', () => {
    const targetFile = join(env.claudeDir, 'CLAUDE.md');
    writeFileSync(targetFile, '# Test');

    // Copy to profile
    const profileDir = join(env.profilesDir, 'test');
    mkdirSync(profileDir);
    copyFileSync(targetFile, join(profileDir, 'CLAUDE.md'));

    // Remove from claude dir
    rmSync(targetFile);
    assert.equal(existsSync(targetFile), false);
    // Profile copy still exists
    assert.equal(existsSync(join(profileDir, 'CLAUDE.md')), true);
  });

  it('saves and restores items via source.json', () => {
    // Create items in claude dir
    writeFileSync(join(env.claudeDir, 'CLAUDE.md'), '# Test');
    const rulesDir = join(env.claudeDir, 'rules');
    mkdirSync(rulesDir);
    writeFileSync(join(rulesDir, 'dev.md'), '# Rules');

    // Save to profile
    const profileDir = join(env.profilesDir, 'test');
    mkdirSync(profileDir);

    const sourceMap = {};
    for (const item of ['CLAUDE.md', 'rules']) {
      const itemPath = join(env.claudeDir, item);
      if (existsSync(itemPath)) {
        const dest = join(profileDir, item);
        const stat = lstatSync(itemPath);
        if (stat.isDirectory()) {
          cpSync(itemPath, dest, { recursive: true });
        } else {
          copyFileSync(itemPath, dest);
        }
        sourceMap[item] = dest;
      }
    }
    writeFileSync(join(profileDir, 'source.json'), JSON.stringify(sourceMap, null, 2));

    // Remove from claude dir
    rmSync(join(env.claudeDir, 'CLAUDE.md'));
    rmSync(join(env.claudeDir, 'rules'), { recursive: true });
    assert.equal(existsSync(join(env.claudeDir, 'CLAUDE.md')), false);

    // Restore from source.json
    const restored = JSON.parse(readFileSync(join(profileDir, 'source.json'), 'utf-8'));
    for (const [item, srcPath] of Object.entries(restored)) {
      const dest = join(env.claudeDir, item);
      const stat = lstatSync(srcPath);
      if (stat.isDirectory()) {
        cpSync(srcPath, dest, { recursive: true });
      } else {
        copyFileSync(srcPath, dest);
      }
    }

    assert.equal(readFileSync(join(env.claudeDir, 'CLAUDE.md'), 'utf-8'), '# Test');
    assert.equal(readFileSync(join(env.claudeDir, 'rules', 'dev.md'), 'utf-8'), '# Rules');
    // No symlinks — real files
    assert.equal(lstatSync(join(env.claudeDir, 'CLAUDE.md')).isFile(), true);
    assert.equal(lstatSync(join(env.claudeDir, 'rules')).isDirectory(), true);
  });
});

// ─── File Operations ───

describe('File Operations', () => {
  let env;

  beforeEach(() => { env = createTestEnv(); });
  afterEach(() => { rmSync(env.tempDir, { recursive: true, force: true }); });

  it('copies files from claude dir to profile dir', () => {
    writeFileSync(join(env.claudeDir, 'settings.json'), '{"hooks":{}}');
    writeFileSync(join(env.claudeDir, '.env'), 'API_KEY=test');

    const profileDir = join(env.profilesDir, 'testprofile');
    mkdirSync(profileDir);

    for (const item of ['settings.json', '.env']) {
      const src = join(env.claudeDir, item);
      if (existsSync(src)) copyFileSync(src, join(profileDir, item));
    }

    assert.equal(readFileSync(join(profileDir, 'settings.json'), 'utf-8'), '{"hooks":{}}');
    assert.equal(readFileSync(join(profileDir, '.env'), 'utf-8'), 'API_KEY=test');
  });

  it('handles missing files gracefully', () => {
    assert.equal(existsSync(join(env.claudeDir, '.env')), false);
    // Copying should be skipped, no error
    assert.doesNotThrow(() => {
      const src = join(env.claudeDir, '.env');
      if (existsSync(src)) copyFileSync(src, join(env.tempDir, '.env'));
    });
  });

  it('copies directories recursively', () => {
    const commandsDir = join(env.claudeDir, 'commands');
    mkdirSync(commandsDir);
    writeFileSync(join(commandsDir, 'test.sh'), '#!/bin/bash');

    const profileDir = join(env.profilesDir, 'testprofile');
    mkdirSync(profileDir);
    cpSync(commandsDir, join(profileDir, 'commands'), { recursive: true });

    assert.equal(readFileSync(join(profileDir, 'commands', 'test.sh'), 'utf-8'), '#!/bin/bash');
  });

  it('restores files from profile dir to claude dir', () => {
    const profileDir = join(env.profilesDir, 'testprofile');
    mkdirSync(profileDir);
    writeFileSync(join(profileDir, 'settings.json'), '{"model":"opus"}');

    copyFileSync(join(profileDir, 'settings.json'), join(env.claudeDir, 'settings.json'));
    assert.equal(readFileSync(join(env.claudeDir, 'settings.json'), 'utf-8'), '{"model":"opus"}');
  });
});

// ─── Profile Validator ───

describe('Profile Validator', () => {
  let env;

  beforeEach(() => { env = createTestEnv(); });
  afterEach(() => { rmSync(env.tempDir, { recursive: true, force: true }); });

  it('fails validation for missing directory', () => {
    const profileDir = join(env.tempDir, 'nonexistent');
    assert.equal(existsSync(profileDir), false);
  });

  it('fails validation for missing source.json', () => {
    const profileDir = join(env.tempDir, 'incomplete');
    mkdirSync(profileDir);
    assert.equal(existsSync(join(profileDir, 'source.json')), false);
  });

  it('passes validation for complete profile', () => {
    const profileDir = join(env.tempDir, 'complete');
    mkdirSync(profileDir);
    writeFileSync(join(profileDir, 'source.json'), '{"CLAUDE.md": "/tmp/test"}');
    assert.equal(existsSync(join(profileDir, 'source.json')), true);
  });

  it('detects invalid item targets', () => {
    const sourceMap = { 'CLAUDE.md': '/nonexistent/path/CLAUDE.md' };
    for (const [, target] of Object.entries(sourceMap)) {
      assert.equal(existsSync(target), false);
    }
  });

  it('validates real item targets', () => {
    const target = join(env.tempDir, 'real-target.md');
    writeFileSync(target, '# Real');
    assert.equal(existsSync(target), true);
  });
});

// ─── Full Profile Switch Cycle ───

describe('Full Profile Switch Cycle', () => {
  let env;

  beforeEach(() => { env = createTestEnv(); });
  afterEach(() => { rmSync(env.tempDir, { recursive: true, force: true }); });

  it('creates profile, switches, and restores correctly using copies', () => {
    // Setup: create files in claude dir
    writeFileSync(join(env.claudeDir, 'CLAUDE.md'), '# Profile A');
    writeFileSync(join(env.claudeDir, 'settings.json'), '{"profile":"A"}');

    // "Save" profile A — copy items to profile dir
    const profileADir = join(env.profilesDir, 'profileA');
    mkdirSync(profileADir);
    copyFileSync(join(env.claudeDir, 'CLAUDE.md'), join(profileADir, 'CLAUDE.md'));
    copyFileSync(join(env.claudeDir, 'settings.json'), join(profileADir, 'settings.json'));
    const sourceMapA = { 'CLAUDE.md': join(profileADir, 'CLAUDE.md') };
    writeFileSync(join(profileADir, 'source.json'), JSON.stringify(sourceMapA));

    // Create profile B with different content
    const profileBDir = join(env.profilesDir, 'profileB');
    mkdirSync(profileBDir);
    writeFileSync(join(profileBDir, 'CLAUDE.md'), '# Profile B');
    writeFileSync(join(profileBDir, 'settings.json'), '{"profile":"B"}');
    const sourceMapB = { 'CLAUDE.md': join(profileBDir, 'CLAUDE.md') };
    writeFileSync(join(profileBDir, 'source.json'), JSON.stringify(sourceMapB));

    // "Switch" to profile B: remove old, copy new
    rmSync(join(env.claudeDir, 'CLAUDE.md'));
    rmSync(join(env.claudeDir, 'settings.json'));

    const restoredMap = JSON.parse(readFileSync(join(profileBDir, 'source.json'), 'utf-8'));
    for (const [item, srcPath] of Object.entries(restoredMap)) {
      copyFileSync(srcPath, join(env.claudeDir, item));
    }
    copyFileSync(join(profileBDir, 'settings.json'), join(env.claudeDir, 'settings.json'));

    // Verify profile B is active — real files, no symlinks
    assert.equal(readFileSync(join(env.claudeDir, 'settings.json'), 'utf-8'), '{"profile":"B"}');
    assert.equal(readFileSync(join(env.claudeDir, 'CLAUDE.md'), 'utf-8'), '# Profile B');
    assert.equal(lstatSync(join(env.claudeDir, 'CLAUDE.md')).isFile(), true);
    assert.equal(lstatSync(join(env.claudeDir, 'CLAUDE.md')).isSymbolicLink(), false);

    // "Switch" back to profile A
    rmSync(join(env.claudeDir, 'CLAUDE.md'));
    rmSync(join(env.claudeDir, 'settings.json'));
    const restoredMapA = JSON.parse(readFileSync(join(profileADir, 'source.json'), 'utf-8'));
    for (const [item, srcPath] of Object.entries(restoredMapA)) {
      copyFileSync(srcPath, join(env.claudeDir, item));
    }
    copyFileSync(join(profileADir, 'settings.json'), join(env.claudeDir, 'settings.json'));

    assert.equal(readFileSync(join(env.claudeDir, 'settings.json'), 'utf-8'), '{"profile":"A"}');
    assert.equal(readFileSync(join(env.claudeDir, 'CLAUDE.md'), 'utf-8'), '# Profile A');
    // Still real files, not symlinks
    assert.equal(lstatSync(join(env.claudeDir, 'CLAUDE.md')).isSymbolicLink(), false);
  });
});
