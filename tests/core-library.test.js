import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, lstatSync, readlinkSync, rmSync, copyFileSync, cpSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

// ─── Symlink Manager ───

describe('Symlink Manager', () => {
  let env;

  beforeEach(() => { env = createTestEnv(); });
  afterEach(() => { rmSync(env.tempDir, { recursive: true, force: true }); });

  it('creates symlinks and reads their targets', () => {
    const targetFile = join(env.tempDir, 'CLAUDE.md');
    writeFileSync(targetFile, '# Test');
    const linkPath = join(env.claudeDir, 'CLAUDE.md');
    symlinkSync(targetFile, linkPath);

    assert.equal(lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(resolve(env.claudeDir, readlinkSync(linkPath)), targetFile);
  });

  it('creates directory symlinks', () => {
    const rulesDir = join(env.tempDir, 'rules');
    mkdirSync(rulesDir);
    writeFileSync(join(rulesDir, 'dev.md'), '# Rules');
    symlinkSync(rulesDir, join(env.claudeDir, 'rules'));

    assert.equal(lstatSync(join(env.claudeDir, 'rules')).isSymbolicLink(), true);
    assert.equal(existsSync(join(env.claudeDir, 'rules', 'dev.md')), true);
  });

  it('removes symlinks without affecting targets', () => {
    const targetFile = join(env.tempDir, 'CLAUDE.md');
    writeFileSync(targetFile, '# Test');
    const linkPath = join(env.claudeDir, 'CLAUDE.md');
    symlinkSync(targetFile, linkPath);

    // Remove symlink
    unlinkSync(linkPath);
    assert.equal(existsSync(linkPath), false);
    // Target still exists
    assert.equal(existsSync(targetFile), true);
  });

  it('saves and restores symlink targets via source.json', () => {
    // Create targets
    const targetFile = join(env.tempDir, 'CLAUDE.md');
    writeFileSync(targetFile, '# Test');
    const rulesDir = join(env.tempDir, 'rules');
    mkdirSync(rulesDir);

    // Create symlinks
    symlinkSync(targetFile, join(env.claudeDir, 'CLAUDE.md'));
    symlinkSync(rulesDir, join(env.claudeDir, 'rules'));

    // Save to source.json
    const sourceMap = {};
    for (const item of ['CLAUDE.md', 'rules']) {
      const itemPath = join(env.claudeDir, item);
      if (lstatSync(itemPath).isSymbolicLink()) {
        sourceMap[item] = resolve(env.claudeDir, readlinkSync(itemPath));
      }
    }
    const profileDir = join(env.profilesDir, 'test');
    mkdirSync(profileDir);
    writeFileSync(join(profileDir, 'source.json'), JSON.stringify(sourceMap, null, 2));

    // Remove symlinks
    unlinkSync(join(env.claudeDir, 'CLAUDE.md'));
    unlinkSync(join(env.claudeDir, 'rules'));
    assert.equal(existsSync(join(env.claudeDir, 'CLAUDE.md')), false);

    // Restore from source.json
    const restored = JSON.parse(readFileSync(join(profileDir, 'source.json'), 'utf-8'));
    for (const [item, target] of Object.entries(restored)) {
      symlinkSync(target, join(env.claudeDir, item));
    }

    assert.equal(lstatSync(join(env.claudeDir, 'CLAUDE.md')).isSymbolicLink(), true);
    assert.equal(resolve(env.claudeDir, readlinkSync(join(env.claudeDir, 'CLAUDE.md'))), targetFile);
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

  it('detects invalid symlink targets', () => {
    const sourceMap = { 'CLAUDE.md': '/nonexistent/path/CLAUDE.md' };
    for (const [, target] of Object.entries(sourceMap)) {
      assert.equal(existsSync(target), false);
    }
  });

  it('validates real symlink targets', () => {
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

  it('creates profile, switches, and restores correctly', () => {
    // Setup: create source files for symlinks
    const agentsSource = join(env.tempDir, 'source-a');
    mkdirSync(agentsSource);
    writeFileSync(join(agentsSource, 'CLAUDE.md'), '# Profile A');

    // Create initial symlink
    symlinkSync(join(agentsSource, 'CLAUDE.md'), join(env.claudeDir, 'CLAUDE.md'));
    writeFileSync(join(env.claudeDir, 'settings.json'), '{"profile":"A"}');

    // "Save" profile A
    const profileADir = join(env.profilesDir, 'profileA');
    mkdirSync(profileADir);

    // Save symlink targets
    const sourceMapA = { 'CLAUDE.md': join(agentsSource, 'CLAUDE.md') };
    writeFileSync(join(profileADir, 'source.json'), JSON.stringify(sourceMapA));
    copyFileSync(join(env.claudeDir, 'settings.json'), join(profileADir, 'settings.json'));

    // Create a different source for profile B
    const agentsSourceB = join(env.tempDir, 'source-b');
    mkdirSync(agentsSourceB);
    writeFileSync(join(agentsSourceB, 'CLAUDE.md'), '# Profile B');

    const profileBDir = join(env.profilesDir, 'profileB');
    mkdirSync(profileBDir);
    const sourceMapB = { 'CLAUDE.md': join(agentsSourceB, 'CLAUDE.md') };
    writeFileSync(join(profileBDir, 'source.json'), JSON.stringify(sourceMapB));
    writeFileSync(join(profileBDir, 'settings.json'), '{"profile":"B"}');

    // "Switch" to profile B: remove old symlinks, restore new ones
    unlinkSync(join(env.claudeDir, 'CLAUDE.md'));
    unlinkSync(join(env.claudeDir, 'settings.json'));

    const restoredMap = JSON.parse(readFileSync(join(profileBDir, 'source.json'), 'utf-8'));
    for (const [item, target] of Object.entries(restoredMap)) {
      symlinkSync(target, join(env.claudeDir, item));
    }
    copyFileSync(join(profileBDir, 'settings.json'), join(env.claudeDir, 'settings.json'));

    // Verify profile B is active
    assert.equal(readFileSync(join(env.claudeDir, 'settings.json'), 'utf-8'), '{"profile":"B"}');
    const linkedTarget = resolve(env.claudeDir, readlinkSync(join(env.claudeDir, 'CLAUDE.md')));
    assert.equal(linkedTarget, join(agentsSourceB, 'CLAUDE.md'));
    assert.equal(readFileSync(join(env.claudeDir, 'CLAUDE.md'), 'utf-8'), '# Profile B');

    // "Switch" back to profile A
    unlinkSync(join(env.claudeDir, 'CLAUDE.md'));
    unlinkSync(join(env.claudeDir, 'settings.json'));
    const restoredMapA = JSON.parse(readFileSync(join(profileADir, 'source.json'), 'utf-8'));
    for (const [item, target] of Object.entries(restoredMapA)) {
      symlinkSync(target, join(env.claudeDir, item));
    }
    copyFileSync(join(profileADir, 'settings.json'), join(env.claudeDir, 'settings.json'));

    assert.equal(readFileSync(join(env.claudeDir, 'settings.json'), 'utf-8'), '{"profile":"A"}');
    assert.equal(readFileSync(join(env.claudeDir, 'CLAUDE.md'), 'utf-8'), '# Profile A');
  });
});
