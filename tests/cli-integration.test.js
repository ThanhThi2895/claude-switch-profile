import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const BIN = join(import.meta.dirname, '..', 'bin', 'csp.js');

const run = (args, env = {}) => {
  try {
    return execSync(`node "${BIN}" ${args}`, {
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      timeout: 10000,
    }).trim();
  } catch (err) {
    return (err.stdout || '').trim() + '\n' + (err.stderr || '').trim();
  }
};

describe('CLI Integration', () => {
  let tempDir, claudeDir, profilesDir, envOverrides;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'csp-cli-'));
    claudeDir = join(tempDir, '.claude');
    profilesDir = join(tempDir, '.claude-profiles');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(profilesDir, { recursive: true });
    envOverrides = { CSP_CLAUDE_DIR: claudeDir, CSP_PROFILES_DIR: profilesDir };

    // Create some files in claude dir to capture
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"opus"}');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('shows version', () => {
    const output = run('--version', envOverrides);
    assert.match(output, /\d+\.\d+\.\d+/);
  });

  it('shows help', () => {
    const output = run('--help', envOverrides);
    assert.ok(output.includes('Claude Switch Profile'));
    assert.ok(output.includes('create'));
    assert.ok(output.includes('use'));
  });

  it('current shows no active profile initially', () => {
    const output = run('current', envOverrides);
    assert.ok(output.includes('No active profile'));
  });

  it('list shows no profiles initially', () => {
    const output = run('list', envOverrides);
    assert.ok(output.includes('No profiles found'));
  });

  it('create produces a full clone profile (inherits current state)', () => {
    const output = run('create testprofile -d "Test profile"', envOverrides);
    assert.ok(output.includes('testprofile'));

    // Verify profile dir and source.json were created
    assert.ok(existsSync(join(profilesDir, 'testprofile')));
    assert.ok(existsSync(join(profilesDir, 'testprofile', 'source.json')));

    // Full clone now copies mutable files from current state
    assert.equal(existsSync(join(profilesDir, 'testprofile', 'settings.json')), true);

    // Verify profiles.json was updated
    const profiles = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    assert.ok(profiles['testprofile']);
    assert.equal(profiles['testprofile'].description, 'Test profile');
  });

  it('create sets first profile as active', () => {
    run('create first -d "First"', envOverrides);
    const output = run('current', envOverrides);
    assert.ok(output.includes('first'));
  });

  it('list shows created profiles', () => {
    run('create alpha -d "Alpha profile"', envOverrides);
    run('create beta -d "Beta profile"', envOverrides);
    const output = run('list', envOverrides);
    assert.ok(output.includes('alpha'));
    assert.ok(output.includes('beta'));
  });

  it('save updates active profile', () => {
    run('create myprofile', envOverrides);

    // Modify settings in claude dir
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"sonnet"}');
    run('save', envOverrides);

    // Verify profile was updated
    const saved = readFileSync(join(profilesDir, 'myprofile', 'settings.json'), 'utf-8');
    assert.equal(saved, '{"model":"sonnet"}');
  });

  it('create --from clones existing profile', () => {
    // Create original with explicit content to clone
    run('create original -d "Original"', envOverrides);
    // Manually add settings.json to original (simulating a save)
    writeFileSync(join(profilesDir, 'original', 'settings.json'), '{"model":"opus"}');

    run('create clone --from original -d "Clone"', envOverrides);

    assert.ok(existsSync(join(profilesDir, 'clone')));
    assert.ok(existsSync(join(profilesDir, 'clone', 'source.json')));

    // Clone should have same settings as original
    const origSettings = readFileSync(join(profilesDir, 'original', 'settings.json'), 'utf-8');
    const cloneSettings = readFileSync(join(profilesDir, 'clone', 'settings.json'), 'utf-8');
    assert.equal(origSettings, cloneSettings);
  });

  it('delete removes non-active profile with --force', () => {
    run('create todelete', envOverrides);
    run('create keeper', envOverrides);
    // Switch to keeper so todelete is not active
    run('use keeper --no-save', envOverrides);
    run('delete todelete --force', envOverrides);

    assert.equal(existsSync(join(profilesDir, 'todelete')), false);
    const profiles = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    assert.equal(profiles['todelete'], undefined);
  });

  it('delete active profile succeeds, clears marker, and NEVER touches claude dir', () => {
    run('create onlyone', envOverrides);
    // onlyone is the active profile (first created = auto-active)
    const beforeOutput = run('current', envOverrides);
    assert.ok(beforeOutput.includes('onlyone'));

    // Ensure claude dir has files before delete
    assert.ok(existsSync(join(claudeDir, 'settings.json')));

    run('delete onlyone --force', envOverrides);

    assert.equal(existsSync(join(profilesDir, 'onlyone')), false);
    // Active marker should be cleared
    const afterOutput = run('current', envOverrides);
    assert.ok(afterOutput.includes('No active profile'));

    // CRITICAL: ~/.claude files must NOT be touched by delete
    assert.ok(existsSync(join(claudeDir, 'settings.json')), 'settings.json must survive delete');
  });

  it('deactivate clears active profile', () => {
    run('create myprofile', envOverrides);
    const beforeOutput = run('current', envOverrides);
    assert.ok(beforeOutput.includes('myprofile'));

    run('deactivate', envOverrides);

    // Active marker should be cleared
    const afterOutput = run('current', envOverrides);
    assert.ok(afterOutput.includes('No active profile'));

    // Profile should still exist
    assert.ok(existsSync(join(profilesDir, 'myprofile')));
  });

  it('use does not create .backup directory', () => {
    run('create profA', envOverrides);
    run('create profB', envOverrides);
    run('use profB --no-save', envOverrides);

    // No .backup should be created
    assert.equal(existsSync(join(profilesDir, '.backup')), false);
  });

  it('export creates tar.gz and import restores it', () => {
    run('create exportme -d "Export test"', envOverrides);
    const archivePath = join(tempDir, 'exportme.csp.tar.gz');
    run(`export exportme -o "${archivePath}"`, envOverrides);

    assert.ok(existsSync(archivePath));

    // Import under different name
    run(`import "${archivePath}" -n imported -d "Imported"`, envOverrides);
    assert.ok(existsSync(join(profilesDir, 'imported')));
    assert.ok(existsSync(join(profilesDir, 'imported', 'source.json')));
  });

  // ─── Default Profile Pass-Through ───

  it('init creates default profile and sets it active', () => {
    run('init', envOverrides);
    const output = run('current', envOverrides);
    assert.ok(output.includes('default'));
    assert.ok(existsSync(join(profilesDir, 'default')));
  });

  it('use default from non-default skips restore', () => {
    run('init', envOverrides);
    // Create and switch to a work profile with content
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work rules');
    run('create work -d "Work"', envOverrides);
    run('use work --no-save', envOverrides);

    // Switch back to default
    const output = run('use default', envOverrides);
    assert.ok(output.includes('default'));

    // Active should be default
    const current = run('current', envOverrides);
    assert.ok(current.includes('default'));
  });

  it('use X from default skips save', () => {
    run('init', envOverrides);
    // Create work profile with content
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work');
    run('create work -d "Work"', envOverrides);

    // Switch to work from default — should not try to save default
    const output = run('use work', envOverrides);
    assert.ok(output.includes('work'));
  });

  it('save on default is no-op', () => {
    run('init', envOverrides);
    const output = run('save', envOverrides);
    assert.ok(output.includes('No save needed') || output.includes('directly'));
  });

  it('deactivate on default is no-op', () => {
    run('init', envOverrides);
    const output = run('deactivate', envOverrides);
    assert.ok(output.includes('Nothing to deactivate') || output.includes('directly'));
  });

  it('delete default is blocked', () => {
    run('init', envOverrides);
    const output = run('delete default --force', envOverrides);
    assert.ok(output.includes('Cannot delete'));
  });

  // ─── Move Semantics (use command) ───

  it('use moves items between profiles via rename', () => {
    run('init', envOverrides);

    // Create two profiles with different content
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Alpha');
    run('create alpha -d "Alpha"', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Beta');
    run('create beta -d "Beta"', envOverrides);

    // Switch from beta to alpha — should move items
    run('use alpha', envOverrides);

    // Alpha's content should be in ~/.claude
    const content = readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8');
    assert.equal(content, '# Alpha');
  });

  it('switch between non-default profiles preserves state', () => {
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# First');
    run('create first -d "First"', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Second');
    run('create second -d "Second"', envOverrides);

    // Switch to first
    run('use first', envOverrides);
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# First');

    // Switch back to second — first should be saved
    run('use second', envOverrides);
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# Second');

    // Switch to first again to verify it was preserved
    run('use first', envOverrides);
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# First');
  });
});
