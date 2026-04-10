import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
  symlinkSync,
  lstatSync,
  readlinkSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

const runResult = (args, env = {}) => {
  try {
    return {
      status: 0,
      stdout: execSync(`node "${BIN}" ${args}`, {
        encoding: 'utf-8',
        env: { ...process.env, ...env },
        timeout: 10000,
      }).trim(),
      stderr: '',
    };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
    };
  }
};

const readCapturedEnv = (captureFile) => {
  const lines = readFileSync(captureFile, 'utf-8').split(/\r?\n/).filter(Boolean);
  const parsed = {};

  for (const line of lines) {
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    parsed[key] = value;
  }

  return parsed;
};

const writeEnvCaptureScript = (scriptPath) => {
  writeFileSync(
    scriptPath,
    [
      "const { writeFileSync } = require('node:fs');",
      "const outFile = process.argv[2];",
      "const keys = ['CLAUDE_CONFIG_DIR', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'];",
      "const lines = keys.map((key) => `${key}=${process.env[key] || ''}`);",
      "writeFileSync(outFile, `${lines.join('\\n')}\\n`);",
    ].join('\n'),
  );
};

const symlinkTarget = (path) => {
  return readlinkSync(path).replaceAll('\\', '/');
};

describe('CLI Integration', () => {
  let tempDir, claudeDir, profilesDir, envOverrides, fakeBinDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'csp-cli-'));
    claudeDir = join(tempDir, '.claude');
    profilesDir = join(tempDir, '.claude-profiles');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(profilesDir, { recursive: true });

    fakeBinDir = join(tempDir, 'bin');
    mkdirSync(fakeBinDir, { recursive: true });

    const fakeShellPath = join(tempDir, 'fake-shell');
    writeFileSync(
      fakeShellPath,
      '#!/usr/bin/env sh\nif [ "$1" = "-ic" ]; then\n  shift\n  if [ -n "$CSP_TEST_SHELL_RC" ] && [ -f "$CSP_TEST_SHELL_RC" ]; then\n    . "$CSP_TEST_SHELL_RC"\n  fi\n  eval "$1"\n  exit $?\nfi\nexec /bin/sh "$@"\n',
    );
    chmodSync(fakeShellPath, 0o755);

    const fakeClaudePath = join(fakeBinDir, process.platform === 'win32' ? 'claude.cmd' : 'claude');
    if (process.platform === 'win32') {
      writeFileSync(
        fakeClaudePath,
        '@echo off\r\nif not "%CSP_TEST_CAPTURE_FILE%"=="" (\r\n  >"%CSP_TEST_CAPTURE_FILE%" (\r\n    echo CLAUDE_CONFIG_DIR=%CLAUDE_CONFIG_DIR%\r\n    echo ANTHROPIC_AUTH_TOKEN=%ANTHROPIC_AUTH_TOKEN%\r\n    echo ANTHROPIC_BASE_URL=%ANTHROPIC_BASE_URL%\r\n    echo ANTHROPIC_MODEL=%ANTHROPIC_MODEL%\r\n  )\r\n)\r\nif "%1"=="--version" (echo fake-claude-0.0.0 & exit /b 0)\r\nexit /b 0\r\n',
      );
    } else {
      writeFileSync(
        fakeClaudePath,
        '#!/usr/bin/env sh\nif [ -n "$CSP_TEST_CAPTURE_FILE" ]; then\n  cat > "$CSP_TEST_CAPTURE_FILE" <<EOF\nCLAUDE_CONFIG_DIR=${CLAUDE_CONFIG_DIR}\nANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}\nANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}\nANTHROPIC_MODEL=${ANTHROPIC_MODEL}\nEOF\nfi\nif [ "$1" = "--version" ]; then\n  echo fake-claude-0.0.0\nfi\nexit 0\n',
      );
      chmodSync(fakeClaudePath, 0o755);
    }

    envOverrides = {
      CSP_CLAUDE_DIR: claudeDir,
      CSP_PROFILES_DIR: profilesDir,
      CSP_TEST_CLAUDE_RUNNING: '0',
      NODE_ENV: 'test',
      PATH: `${fakeBinDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`,
      SHELL: process.platform === 'win32' ? process.env.SHELL : fakeShellPath,
    };

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

  it('shows version with -v', () => {
    const result = runResult('-v', envOverrides);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\d+\.\d+\.\d+/);
    assert.equal(result.stderr, '');
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

  it('create produces an empty profile by default', () => {
    const output = run('create testprofile -d "Test profile"', envOverrides);
    assert.ok(output.includes('testprofile'));

    // Verify profile dir and source.json were created
    assert.ok(existsSync(join(profilesDir, 'testprofile')));
    assert.ok(existsSync(join(profilesDir, 'testprofile', 'source.json')));

    // Default create should be empty (no inherited mutable files)
    assert.equal(existsSync(join(profilesDir, 'testprofile', 'settings.json')), false);

    // Managed dirs are created empty
    assert.equal(existsSync(join(profilesDir, 'testprofile', 'rules')), true);
    assert.equal(existsSync(join(profilesDir, 'testprofile', 'agents')), true);
    assert.equal(existsSync(join(profilesDir, 'testprofile', 'skills')), true);
    assert.equal(existsSync(join(profilesDir, 'testprofile', 'hooks')), true);

    // Verify profiles.json was updated
    const profilesMeta = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    const profiles = profilesMeta.profiles || profilesMeta;
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
    assert.ok(output.includes('[account-session]'));
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

  it('create --from preserves symlinked managed items', () => {
    const hooksTargetDir = join(tempDir, 'clone-hooks-target');
    mkdirSync(hooksTargetDir, { recursive: true });
    writeFileSync(join(hooksTargetDir, 'pre-use.cjs'), 'module.exports = {};\n');
    symlinkSync(hooksTargetDir, join(claudeDir, 'hooks'));

    run('init', envOverrides);
    run('create clone --from default -d "Clone"', envOverrides);

    const clonedHooks = join(profilesDir, 'clone', 'hooks');
    assert.equal(lstatSync(clonedHooks).isSymbolicLink(), true);
    assert.equal(symlinkTarget(clonedHooks), hooksTargetDir.replaceAll('\\', '/'));
  });

  it('delete removes non-active profile with --force', () => {
    run('create todelete', envOverrides);
    run('create keeper', envOverrides);
    // Switch to keeper so todelete is not active
    run('use keeper --no-save', envOverrides);
    run('delete todelete --force', envOverrides);

    assert.equal(existsSync(join(profilesDir, 'todelete')), false);
    const profilesMeta = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    const profiles = profilesMeta.profiles || profilesMeta;
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
    run('init', envOverrides);
    run('create myprofile', envOverrides);
    run('use myprofile --no-save', envOverrides);

    const beforeOutput = run('current', envOverrides);
    assert.ok(beforeOutput.includes('myprofile'));

    run('deactivate', envOverrides);

    const afterOutput = run('current', envOverrides);
    assert.ok(afterOutput.includes('default'));
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

  it('import rejects unsafe managed symlinks escaping the profile tree', () => {
    const profileDir = join(tempDir, 'unsafe-profile');
    mkdirSync(profileDir, { recursive: true });
    const externalTargetDir = join(tempDir, 'external-hooks');
    mkdirSync(externalTargetDir, { recursive: true });
    writeFileSync(join(externalTargetDir, 'pre-use.cjs'), 'module.exports = {};\n');
    symlinkSync(externalTargetDir, join(profileDir, 'hooks'));
    writeFileSync(join(profileDir, 'source.json'), JSON.stringify({ hooks: join(profileDir, 'hooks') }, null, 2));

    const archivePath = join(tempDir, 'unsafe-profile.csp.tar.gz');
    const tarCommand = process.platform === 'win32'
      ? `tar.exe --force-local -czf "${archivePath}" -C "${profileDir.replaceAll('\\', '/')}" .`
      : `tar -czf "${archivePath}" -C "${profileDir}" .`;
    execSync(tarCommand, { stdio: 'ignore' });

    const output = run(`import "${archivePath}" -n unsafe-import`, envOverrides);

    if (process.platform === 'win32') {
      assert.ok(output.includes('Profile "unsafe-import" imported'));
      assert.equal(existsSync(join(profilesDir, 'unsafe-import')), true);
      return;
    }

    assert.ok(output.includes('unsafe symlink'));
    assert.equal(existsSync(join(profilesDir, 'unsafe-import')), false);
  });

  // ─── Real Default Profile ───

  it('init creates physical default profile and sets it active', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');

    run('init', envOverrides);

    const output = run('current', envOverrides);
    assert.ok(output.includes('default'));
    assert.ok(output.includes('Active legacy profile'));
    assert.ok(output.includes(join(profilesDir, 'default')));
    assert.equal(existsSync(join(profilesDir, 'default')), true);
    assert.equal(existsSync(join(profilesDir, 'default', 'source.json')), true);
    assert.equal(readFileSync(join(profilesDir, 'default', 'CLAUDE.md'), 'utf-8'), '# Default baseline');

    const listOutput = run('list', envOverrides);
    assert.ok(listOutput.includes('[legacy]'));
  });

  it('init preserves symlinked managed items in the default snapshot', () => {
    const hooksTargetDir = join(tempDir, 'hook-target');
    mkdirSync(hooksTargetDir, { recursive: true });
    writeFileSync(join(hooksTargetDir, 'pre-use.cjs'), 'module.exports = {};\n');
    symlinkSync(hooksTargetDir, join(claudeDir, 'hooks'));

    run('init', envOverrides);

    const defaultHooks = join(profilesDir, 'default', 'hooks');
    const sourceMap = JSON.parse(readFileSync(join(profilesDir, 'default', 'source.json'), 'utf-8'));

    assert.equal(lstatSync(defaultHooks).isSymbolicLink(), true);
    assert.equal(symlinkTarget(defaultHooks), hooksTargetDir.replaceAll('\\', '/'));
    assert.equal(sourceMap.hooks, defaultHooks);
  });

  it('use default restores saved baseline and snapshots active profile', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"opus"}');
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work seed');
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"sonnet"}');
    run('create work -d "Work"', envOverrides);
    run('use work --no-save', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work live rules');
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"haiku"}');

    const output = run('use default', envOverrides);
    assert.ok(output.includes('default'));

    const current = run('current', envOverrides);
    assert.ok(current.includes('default'));
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# Default baseline');
    assert.equal(readFileSync(join(claudeDir, 'settings.json'), 'utf-8'), '{"model":"opus"}');
    assert.equal(readFileSync(join(profilesDir, 'work', 'CLAUDE.md'), 'utf-8'), '# Work live rules');
    assert.equal(readFileSync(join(profilesDir, 'work', 'settings.json'), 'utf-8'), '{"model":"haiku"}');
  });

  it('use from default saves the updated default snapshot', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Updated default');
    run('create work --from default -d "Work"', envOverrides);
    writeFileSync(join(profilesDir, 'work', 'CLAUDE.md'), '# Work profile');

    const output = run('use work', envOverrides);
    assert.ok(output.includes('work'));
    assert.equal(readFileSync(join(profilesDir, 'default', 'CLAUDE.md'), 'utf-8'), '# Updated default');
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# Work profile');
  });

  it('save on default updates the default profile snapshot', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Saved default');
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"sonnet"}');
    run('save', envOverrides);

    assert.equal(readFileSync(join(profilesDir, 'default', 'CLAUDE.md'), 'utf-8'), '# Saved default');
    assert.equal(readFileSync(join(profilesDir, 'default', 'settings.json'), 'utf-8'), '{"model":"sonnet"}');
  });

  it('deactivate switches back to the default profile snapshot', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work profile');
    run('create myprofile', envOverrides);
    run('use myprofile --no-save', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work live');
    const output = run('deactivate', envOverrides);

    assert.ok(output.includes('default'));
    const afterOutput = run('current', envOverrides);
    assert.ok(afterOutput.includes('default'));
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# Default baseline');
    assert.equal(readFileSync(join(profilesDir, 'myprofile', 'CLAUDE.md'), 'utf-8'), '# Work live');
  });

  it('deactivate on default is a no-op', () => {
    run('init', envOverrides);
    const output = run('deactivate', envOverrides);
    assert.ok(output.includes('already active'));
  });

  it('current backfills a missing legacy default snapshot when default is active', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Legacy default');
    writeFileSync(
      join(profilesDir, 'profiles.json'),
      JSON.stringify(
        {
          version: 2,
          profiles: {
            default: { created: '2026-03-31T00:00:00.000Z', description: 'Legacy default', mode: 'legacy' },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, '.active'), 'default\n');

    const output = run('current', envOverrides);

    assert.ok(output.includes(join(profilesDir, 'default')));
    assert.equal(existsSync(join(profilesDir, 'default', 'source.json')), true);
    assert.equal(readFileSync(join(profilesDir, 'default', 'CLAUDE.md'), 'utf-8'), '# Legacy default');
  });

  it('use default fails closed when legacy default snapshot is missing and non-default is active', () => {
    writeFileSync(
      join(profilesDir, 'profiles.json'),
      JSON.stringify(
        {
          version: 2,
          profiles: {
            default: { created: '2026-03-31T00:00:00.000Z', description: 'Legacy default', mode: 'legacy' },
            work: { created: '2026-03-31T00:00:00.000Z', description: 'Work', mode: 'account-session' },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, '.active'), 'work\n');
    mkdirSync(join(profilesDir, 'work'), { recursive: true });
    writeFileSync(join(profilesDir, 'work', 'CLAUDE.md'), '# Work snapshot');
    writeFileSync(
      join(profilesDir, 'work', 'source.json'),
      JSON.stringify({ 'CLAUDE.md': join(profilesDir, 'work', 'CLAUDE.md') }, null, 2),
    );

    const output = run('use default', envOverrides);

    assert.ok(output.includes('cannot safely recreate "default"') || output.includes('cannot safely recreate'));
    assert.equal(existsSync(join(profilesDir, 'default')), false);
  });

  it('export default creates a tar.gz archive', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');
    run('init', envOverrides);
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Exported default');
    run('save', envOverrides);

    const archivePath = join(tempDir, 'default.csp.tar.gz');
    run(`export default -o "${archivePath}"`, envOverrides);

    assert.equal(existsSync(archivePath), true);
  });

  it('launch default writes runtime metadata and uses live active default state', () => {
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"opus"}');
    run('init', envOverrides);
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"haiku"}');

    const captureFile = join(tempDir, 'default-active-launch.txt');
    run('launch default -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureFile,
    });

    const captured = readCapturedEnv(captureFile);
    const runtimeSettings = readFileSync(join(profilesDir, '.runtime', 'default', 'settings.json'), 'utf-8');
    const profilesMeta = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    const profiles = profilesMeta.profiles || profilesMeta;

    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'default'));
    assert.equal(runtimeSettings, '{"model":"haiku"}');
    assert.ok(typeof profiles.default.runtimeDir === 'string' && profiles.default.runtimeDir.length > 0);
    assert.ok(typeof profiles.default.lastLaunchAt === 'string' && profiles.default.lastLaunchAt.length > 0);
  });

  it('launch default preserves managed symlinks in runtime config', () => {
    const hooksTargetDir = join(tempDir, 'runtime-hooks-target');
    mkdirSync(hooksTargetDir, { recursive: true });
    writeFileSync(join(hooksTargetDir, 'pre-use.cjs'), 'module.exports = {};\n');
    symlinkSync(hooksTargetDir, join(claudeDir, 'hooks'));

    run('init', envOverrides);
    run('launch default -- --version', envOverrides);

    const runtimeHooks = join(profilesDir, '.runtime', 'default', 'hooks');
    assert.equal(lstatSync(runtimeHooks).isSymbolicLink(), true);
    assert.equal(symlinkTarget(runtimeHooks), hooksTargetDir.replaceAll('\\', '/'));
  });

  it('launch default uses the stored snapshot when default is inactive', () => {
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"opus"}');
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"sonnet"}');
    run('create work -d "Work"', envOverrides);
    run('use work --no-save', envOverrides);
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"haiku"}');

    const captureFile = join(tempDir, 'default-inactive-launch.txt');
    run('launch default -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureFile,
    });

    const captured = readCapturedEnv(captureFile);
    const runtimeSettings = readFileSync(join(profilesDir, '.runtime', 'default', 'settings.json'), 'utf-8');

    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'default'));
    assert.equal(runtimeSettings, '{"model":"opus"}');
  });

  it('diff current default compares stored source manifests for active default', () => {
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Default baseline');
    run('init', envOverrides);

    const output = run('diff current default', envOverrides);
    assert.ok(output.includes('Managed item sources (source.json): identical'));
  });

  it('update --method npm --force prints matching update command', () => {
    const result = runResult('update --method npm --force', envOverrides);

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('npm install -g claude-switch-profile@latest'));
    assert.equal(result.stderr, '');
  });

  it('update --method brew --force prints matching update command', () => {
    const result = runResult('update --method brew --force', envOverrides);

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('brew upgrade claude-switch-profile'));
    assert.equal(result.stderr, '');
  });

  it('update --method standalone --force reruns local install script', () => {
    const result = runResult('update --method standalone --force', envOverrides);

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('Standalone update (dry run in test mode):'));
    assert.ok(result.stdout.includes('bash '));
    assert.equal(result.stderr, '');
  });

  it('update auto-detects npm when running from repo path', () => {
    const result = runResult('update --force', envOverrides);

    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('Method: npm (auto-detected; override with --method)'));
    assert.ok(result.stdout.includes('npm update (dry run in test mode):'));
    assert.ok(result.stdout.includes('npm install -g claude-switch-profile@latest'));
    assert.equal(result.stderr, '');
  });

  it('update requires a valid --method when provided', () => {
    const invalidMethod = runResult('update --method invalid --force', envOverrides);
    assert.notEqual(invalidMethod.status, 0);
    assert.match(`${invalidMethod.stdout}\n${invalidMethod.stderr}`, /invalid|method|option/i);
  });

  it('uninstall --method npm prints matching uninstall command and keeps profiles', () => {
    run('init', envOverrides);

    const output = run('uninstall --method npm --force', envOverrides);

    assert.equal(existsSync(profilesDir), true);
    assert.ok(output.includes('npm uninstall -g claude-switch-profile'));
    assert.ok(output.includes('Profiles are kept'));
  });

  it('uninstall --method brew prints matching uninstall command and keeps profiles', () => {
    run('init', envOverrides);

    const output = run('uninstall --method brew --force', envOverrides);

    assert.equal(existsSync(profilesDir), true);
    assert.ok(output.includes('brew uninstall claude-switch-profile'));
    assert.ok(output.includes('Profiles are kept'));
  });

  it('uninstall --method standalone removes local wrapper and install dir in test mode', () => {
    run('init', envOverrides);

    const installDir = join(tempDir, '.csp-cli');
    const wrapperPath = join(fakeBinDir, 'csp');
    mkdirSync(installDir, { recursive: true });
    writeFileSync(wrapperPath, '#!/usr/bin/env sh\n');

    const output = run('uninstall --method standalone --force', {
      ...envOverrides,
      CSP_HOME: tempDir,
      CSP_STANDALONE_BIN_DIR: fakeBinDir,
    });

    assert.equal(existsSync(profilesDir), true);
    assert.equal(existsSync(installDir), false);
    assert.equal(existsSync(wrapperPath), false);
    assert.ok(output.includes('Removed standalone install artifacts'));
    assert.ok(output.includes('Profiles are kept'));
  });

  it('launch default keeps default profile mode as legacy', () => {
    run('init', envOverrides);
    run('launch default -- --version', envOverrides);

    const profilesMeta = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    const profiles = profilesMeta.profiles || profilesMeta;
    assert.equal(profiles.default.mode, 'legacy');
  });

  it('delete default is blocked', () => {
    run('init', envOverrides);
    const output = run('delete default --force', envOverrides);
    assert.ok(output.includes('Cannot delete'));
  });

  // ─── Copy Semantics (use command) ───

  it('use copies items from target profile without consuming snapshot', () => {
    run('init', envOverrides);

    // Create two profiles with different content
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Alpha');
    run('create alpha --from default -d "Alpha"', envOverrides);

    writeFileSync(join(profilesDir, 'alpha', 'CLAUDE.md'), '# Alpha');
    writeFileSync(
      join(profilesDir, 'alpha', 'source.json'),
      JSON.stringify({ 'CLAUDE.md': join(profilesDir, 'alpha', 'CLAUDE.md') }, null, 2),
    );
    mkdirSync(join(profilesDir, 'alpha', 'commands'), { recursive: true });
    writeFileSync(join(profilesDir, 'alpha', 'commands', 'alpha-command.sh'), 'echo alpha');

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Beta');
    run('create beta --from default -d "Beta"', envOverrides);

    writeFileSync(join(profilesDir, 'beta', 'CLAUDE.md'), '# Beta');
    writeFileSync(
      join(profilesDir, 'beta', 'source.json'),
      JSON.stringify({ 'CLAUDE.md': join(profilesDir, 'beta', 'CLAUDE.md') }, null, 2),
    );

    // Switch from beta to alpha — should copy items
    run('use alpha', envOverrides);

    // Alpha's content should be in ~/.claude
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), '# Alpha');

    // Target profile snapshot must remain intact after switch
    assert.equal(readFileSync(join(profilesDir, 'alpha', 'CLAUDE.md'), 'utf-8'), '# Alpha');
    assert.equal(readFileSync(join(claudeDir, 'commands', 'alpha-command.sh'), 'utf-8'), 'echo alpha');
    assert.equal(readFileSync(join(profilesDir, 'alpha', 'commands', 'alpha-command.sh'), 'utf-8'), 'echo alpha');
  });

  it('switch between non-default profiles preserves state', () => {
    run('init', envOverrides);

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# First');
    run('create first --from default -d "First"', envOverrides);
    writeFileSync(join(profilesDir, 'first', 'CLAUDE.md'), '# First');
    writeFileSync(
      join(profilesDir, 'first', 'source.json'),
      JSON.stringify({ 'CLAUDE.md': join(profilesDir, 'first', 'CLAUDE.md') }, null, 2),
    );

    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Second');
    run('create second --from default -d "Second"', envOverrides);
    writeFileSync(join(profilesDir, 'second', 'CLAUDE.md'), '# Second');
    writeFileSync(
      join(profilesDir, 'second', 'source.json'),
      JSON.stringify({ 'CLAUDE.md': join(profilesDir, 'second', 'CLAUDE.md') }, null, 2),
    );

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

  it('launch writes runtime metadata in profiles.json', () => {
    run('init', envOverrides);
    run('create launchmeta -d "Launch Meta"', envOverrides);

    run('launch launchmeta -- --version', envOverrides);

    const profilesMeta = JSON.parse(readFileSync(join(profilesDir, 'profiles.json'), 'utf-8'));
    const profiles = profilesMeta.profiles || profilesMeta;
    const meta = profiles.launchmeta;

    assert.equal(meta.mode, 'account-session');
    assert.ok(typeof meta.runtimeDir === 'string' && meta.runtimeDir.length > 0);
    assert.ok(typeof meta.lastLaunchAt === 'string' && meta.lastLaunchAt.length > 0);
  });

  it('launch keeps .active marker unchanged', () => {
    run('init', envOverrides);
    run('create alpha -d "Alpha"', envOverrides);
    run('create beta -d "Beta"', envOverrides);
    run('use alpha --no-save', envOverrides);

    const beforeActive = readFileSync(join(profilesDir, '.active'), 'utf-8').trim();
    run('launch beta -- --version', envOverrides);
    const afterActive = readFileSync(join(profilesDir, '.active'), 'utf-8').trim();

    assert.equal(beforeActive, 'alpha');
    assert.equal(afterActive, 'alpha');
  });

  it('launch creates isolated runtime config', () => {
    run('init', envOverrides);
    run('create runtime-a -d "Runtime A"', envOverrides);
    run('create runtime-b -d "Runtime B"', envOverrides);

    writeFileSync(join(profilesDir, 'runtime-a', 'settings.json'), '{"model":"opus"}');
    writeFileSync(join(profilesDir, 'runtime-b', 'settings.json'), '{"model":"haiku"}');

    run('launch runtime-a -- --version', envOverrides);
    run('launch runtime-b -- --version', envOverrides);

    const runtimeRoot = join(profilesDir, '.runtime');
    const runtimeASettings = readFileSync(join(runtimeRoot, 'runtime-a', 'settings.json'), 'utf-8');
    const runtimeBSettings = readFileSync(join(runtimeRoot, 'runtime-b', 'settings.json'), 'utf-8');

    assert.equal(runtimeASettings, '{"model":"opus"}');
    assert.equal(runtimeBSettings, '{"model":"haiku"}');
  });

  it('launch syncs updated profile config into runtime root', () => {
    run('init', envOverrides);
    run('create syncme -d "Sync Me"', envOverrides);

    writeFileSync(join(profilesDir, 'syncme', 'settings.json'), '{"model":"sonnet"}');
    run('launch syncme -- --version', envOverrides);

    writeFileSync(join(profilesDir, 'syncme', 'settings.json'), '{"model":"opus"}');
    run('launch syncme -- --version', envOverrides);

    const runtimeSettings = readFileSync(join(profilesDir, '.runtime', 'syncme', 'settings.json'), 'utf-8');
    assert.equal(runtimeSettings, '{"model":"opus"}');
  });

  it('launch active non-default profile uses stored snapshot instead of live ~/.claude settings', () => {
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"opus"}');
    run('init', envOverrides);
    run('create work -d "Work"', envOverrides);

    writeFileSync(join(profilesDir, 'work', 'settings.json'), '{"model":"sonnet"}');
    run('use work --no-save', envOverrides);
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"haiku"}');

    const captureFile = join(tempDir, 'work-active-launch.txt');
    run('launch work -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureFile,
    });

    const captured = readCapturedEnv(captureFile);
    const runtimeSettings = readFileSync(join(profilesDir, '.runtime', 'work', 'settings.json'), 'utf-8');

    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'work'));
    assert.equal(runtimeSettings, '{"model":"sonnet"}');
  });

  it('launch keeps per-profile runtime env isolated across profiles', () => {
    run('init', envOverrides);
    run('create iso-a -d "Iso A"', envOverrides);
    run('create iso-b -d "Iso B"', envOverrides);

    writeFileSync(
      join(profilesDir, 'iso-a', 'settings.json'),
      JSON.stringify({ env: { ANTHROPIC_MODEL: 'model-a' } }, null, 2),
    );
    writeFileSync(
      join(profilesDir, 'iso-b', 'settings.json'),
      JSON.stringify({ env: { ANTHROPIC_MODEL: 'model-b' } }, null, 2),
    );

    const captureA = join(tempDir, 'iso-a-capture.txt');
    const captureB = join(tempDir, 'iso-b-capture.txt');

    run('launch iso-a -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureA,
    });
    run('launch iso-b -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureB,
    });

    const envA = readCapturedEnv(captureA);
    const envB = readCapturedEnv(captureB);

    assert.equal(envA.ANTHROPIC_MODEL, 'model-a');
    assert.equal(envB.ANTHROPIC_MODEL, 'model-b');
    assert.notEqual(envA.CLAUDE_CONFIG_DIR, envB.CLAUDE_CONFIG_DIR);
  });

  it('isolated launch injects profile ANTHROPIC env and ignores conflicting parent values', () => {
    run('init', envOverrides);
    run('create envprio -d "Env Priority"', envOverrides);

    writeFileSync(
      join(profilesDir, 'envprio', 'settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'profile-token',
            ANTHROPIC_BASE_URL: 'https://profile.example.com',
            ANTHROPIC_MODEL: 'profile-model',
          },
        },
        null,
        2,
      ),
    );

    const captureFile = join(tempDir, 'envprio-capture.txt');
    run('launch envprio -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureFile,
      ANTHROPIC_AUTH_TOKEN: 'parent-token',
      ANTHROPIC_BASE_URL: 'https://parent.example.com',
      ANTHROPIC_MODEL: 'parent-model',
    });

    const captured = readCapturedEnv(captureFile);
    assert.equal(captured.ANTHROPIC_AUTH_TOKEN, 'profile-token');
    assert.equal(captured.ANTHROPIC_BASE_URL, 'https://profile.example.com');
    assert.equal(captured.ANTHROPIC_MODEL, 'profile-model');
    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'envprio'));
  });

  it('isolated launch uses settings then .env then parent fallback precedence', () => {
    run('init', envOverrides);
    run('create envfallback -d "Env Fallback"', envOverrides);

    writeFileSync(
      join(profilesDir, 'envfallback', 'settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          env: {
            ANTHROPIC_AUTH_TOKEN: 'settings-token',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, 'envfallback', '.env'), 'ANTHROPIC_BASE_URL=https://dotenv.example.com\n');

    const captureFile = join(tempDir, 'envfallback-capture.txt');
    run('launch envfallback -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureFile,
      ANTHROPIC_BASE_URL: 'https://parent.example.com',
      ANTHROPIC_MODEL: 'parent-model',
    });

    const captured = readCapturedEnv(captureFile);
    assert.equal(captured.ANTHROPIC_AUTH_TOKEN, 'settings-token');
    assert.equal(captured.ANTHROPIC_BASE_URL, 'https://dotenv.example.com');
    assert.equal(captured.ANTHROPIC_MODEL, 'parent-model');
  });

  it('isolated launch handles case-insensitive ANTHROPIC keys', () => {
    run('init', envOverrides);
    run('create envcase -d "Env Case"', envOverrides);

    writeFileSync(
      join(profilesDir, 'envcase', 'settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          env: {
            anthropic_model: 'settings-model-lc',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, 'envcase', '.env'), 'anthropic_auth_token=dotenv-token-lc\n');

    const captureFile = join(tempDir, 'envcase-capture.txt');
    run('launch envcase -- --version', {
      ...envOverrides,
      CSP_TEST_CAPTURE_FILE: captureFile,
      ANTHROPIC_BASE_URL: 'https://parent-lc.example.com',
    });

    const captured = readCapturedEnv(captureFile);
    assert.equal(captured.ANTHROPIC_AUTH_TOKEN, 'dotenv-token-lc');
    assert.equal(captured.ANTHROPIC_BASE_URL, 'https://parent-lc.example.com');
    assert.equal(captured.ANTHROPIC_MODEL, 'settings-model-lc');
  });

  it('use refuses to switch while Claude is running', () => {
    run('init', envOverrides);
    run('create alpha -d "Alpha"', envOverrides);
    run('create beta -d "Beta"', envOverrides);
    run('use alpha --no-save', envOverrides);

    const output = run('use beta', {
      ...envOverrides,
      CSP_TEST_CLAUDE_RUNNING: '1',
    });

    assert.ok(output.includes('Close all Claude sessions before switching profiles'));
    const active = readFileSync(join(profilesDir, '.active'), 'utf-8').trim();
    assert.equal(active, 'alpha');
  });

  it('legacy launch path still updates active profile', () => {
    run('init', envOverrides);
    run('create legacy-a -d "Legacy A"', envOverrides);
    run('create legacy-b -d "Legacy B"', envOverrides);
    run('use legacy-a --no-save', envOverrides);

    run('launch legacy-b --legacy-global -- --version', envOverrides);

    const active = readFileSync(join(profilesDir, '.active'), 'utf-8').trim();
    assert.equal(active, 'legacy-b');
  });

  it('runtime launch lock file is cleaned after launch', () => {
    run('init', envOverrides);
    run('create lockme -d "Lock Me"', envOverrides);

    run('launch lockme -- --version', envOverrides);
    run('launch lockme -- --version', envOverrides);

    assert.equal(existsSync(join(profilesDir, '.runtime.lockme.lock')), false);
  });

  it('exec runs arbitrary command in isolated profile runtime env', () => {
    run('init', envOverrides);
    run('create execiso -d "Exec Isolated"', envOverrides);

    writeFileSync(
      join(profilesDir, 'execiso', 'settings.json'),
      JSON.stringify(
        {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'exec-token',
            ANTHROPIC_MODEL: 'exec-model',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, 'execiso', '.env'), 'ANTHROPIC_BASE_URL=https://exec.example.com\n');

    const scriptPath = join(tempDir, 'capture-env.js');
    writeEnvCaptureScript(scriptPath);

    const outputFile = join(tempDir, 'exec-capture.txt');
    run(`exec execiso -- node "${scriptPath}" "${outputFile}"`, {
      ...envOverrides,
      ANTHROPIC_AUTH_TOKEN: 'parent-token',
      ANTHROPIC_BASE_URL: 'https://parent.example.com',
      ANTHROPIC_MODEL: 'parent-model',
    });

    const captured = readCapturedEnv(outputFile);
    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'execiso'));
    assert.equal(captured.ANTHROPIC_AUTH_TOKEN, 'exec-token');
    assert.equal(captured.ANTHROPIC_BASE_URL, 'https://exec.example.com');
    assert.equal(captured.ANTHROPIC_MODEL, 'exec-model');
  });

  it('exec keeps .active marker unchanged', () => {
    run('init', envOverrides);
    run('create alpha -d "Alpha"', envOverrides);
    run('create beta -d "Beta"', envOverrides);
    run('use alpha --no-save', envOverrides);

    const scriptPath = join(tempDir, 'capture-env.js');
    writeEnvCaptureScript(scriptPath);
    const outputFile = join(tempDir, 'exec-active-capture.txt');

    const beforeActive = readFileSync(join(profilesDir, '.active'), 'utf-8').trim();
    run(`exec beta -- node "${scriptPath}" "${outputFile}"`, envOverrides);
    const afterActive = readFileSync(join(profilesDir, '.active'), 'utf-8').trim();

    assert.equal(beforeActive, 'alpha');
    assert.equal(afterActive, 'alpha');
  });

  it('exec resolves shell functions via interactive shell on non-Windows', () => {
    if (process.platform === 'win32') return;

    run('init', envOverrides);
    run('create shellfn -d "Shell Function"', envOverrides);

    writeFileSync(
      join(profilesDir, 'shellfn', 'settings.json'),
      JSON.stringify(
        {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'shell-token',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, 'shellfn', '.env'), 'ANTHROPIC_BASE_URL=https://shell.example.com\n');

    const commandName = 'claude_hd2';
    const outputFile = join(tempDir, 'exec-shell-capture.txt');
    const captureScriptPath = join(tempDir, 'capture-env.js');
    const shellRcPath = join(tempDir, 'fake-shell-rc.sh');
    writeEnvCaptureScript(captureScriptPath);
    writeFileSync(
      shellRcPath,
      `${commandName}() {\n  node '${captureScriptPath.replaceAll("'", `'"'"'`)}' '${outputFile.replaceAll("'", `'"'"'`)}'\n}\n`,
    );

    run(`exec shellfn -- ${commandName}`, {
      ...envOverrides,
      CSP_TEST_SHELL_RC: shellRcPath,
      ANTHROPIC_AUTH_TOKEN: 'parent-token',
      ANTHROPIC_BASE_URL: 'https://parent.example.com',
    });

    const captured = readCapturedEnv(outputFile);
    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'shellfn'));
    assert.equal(captured.ANTHROPIC_AUTH_TOKEN, 'shell-token');
    assert.equal(captured.ANTHROPIC_BASE_URL, 'https://shell.example.com');
  });

  it('exec reasserts isolated env after shell init on non-Windows', () => {
    if (process.platform === 'win32') return;

    run('init', envOverrides);
    run('create shellenv -d "Shell Env"', envOverrides);

    writeFileSync(
      join(profilesDir, 'shellenv', 'settings.json'),
      JSON.stringify(
        {
          env: {
            ANTHROPIC_AUTH_TOKEN: 'isolated-token',
            ANTHROPIC_MODEL: 'isolated-model',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(profilesDir, 'shellenv', '.env'), 'ANTHROPIC_BASE_URL=https://isolated.example.com\n');

    const scriptPath = join(tempDir, 'capture-shell-env.js');
    writeEnvCaptureScript(scriptPath);
    const outputFile = join(tempDir, 'exec-shell-env-capture.txt');
    const shellRcPath = join(tempDir, 'override-shell-rc.sh');
    writeFileSync(
      shellRcPath,
      [
        'export ANTHROPIC_AUTH_TOKEN=rc-token',
        'export ANTHROPIC_BASE_URL=https://rc.example.com',
        'export ANTHROPIC_MODEL=rc-model',
        'export CLAUDE_CONFIG_DIR=/tmp/rc-config',
      ].join('\n') + '\n',
    );

    run(`exec shellenv -- node "${scriptPath}" "${outputFile}"`, {
      ...envOverrides,
      CSP_TEST_SHELL_RC: shellRcPath,
      ANTHROPIC_AUTH_TOKEN: 'parent-token',
      ANTHROPIC_BASE_URL: 'https://parent.example.com',
      ANTHROPIC_MODEL: 'parent-model',
    });

    const captured = readCapturedEnv(outputFile);
    assert.equal(captured.CLAUDE_CONFIG_DIR, join(profilesDir, '.runtime', 'shellenv'));
    assert.equal(captured.ANTHROPIC_AUTH_TOKEN, 'isolated-token');
    assert.equal(captured.ANTHROPIC_BASE_URL, 'https://isolated.example.com');
    assert.equal(captured.ANTHROPIC_MODEL, 'isolated-model');
  });

  it('launch rewrites shell variable hook paths in settings.json to runtime dir', () => {
    run('init', envOverrides);
    run('create hookprofile -d "Hook Profile"', envOverrides);

    writeFileSync(
      join(profilesDir, 'hookprofile', 'settings.json'),
      JSON.stringify(
        {
          skipDangerousModePermissionPrompt: true,
          hooks: {
            SessionStart: [
              {
                matcher: 'startup',
                hooks: [
                  {
                    type: 'command',
                    command: `node "$HOME/.claude/hooks/session-init.cjs"`,
                  },
                ],
              },
            ],
            PreToolUse: [
              {
                matcher: 'Write',
                hooks: [
                  {
                    type: 'command',
                    command: `node "\${HOME}/.claude/hooks/descriptive-name.cjs"`,
                  },
                ],
              },
            ],
            PostToolUse: [
              {
                matcher: 'Write',
                hooks: [
                  {
                    type: 'command',
                    command: `node "~/.claude/hooks/post-edit.cjs"`,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    run('launch hookprofile -- --version', envOverrides);

    const runtimeSettingsPath = join(profilesDir, '.runtime', 'hookprofile', 'settings.json');
    const runtimeSettings = readFileSync(runtimeSettingsPath, 'utf-8');
    const runtimeDir = join(profilesDir, '.runtime', 'hookprofile');

    // All shell variable patterns should be rewritten to the runtime directory
    assert.ok(!runtimeSettings.includes('$HOME/.claude/'), 'should not contain $HOME/.claude/');
    assert.ok(!runtimeSettings.includes('${HOME}/.claude/'), 'should not contain ${HOME}/.claude/');
    assert.ok(!runtimeSettings.includes('~/.claude/'), 'should not contain ~/.claude/');

    // The runtime directory path should be present instead
    assert.ok(runtimeSettings.includes(`${runtimeDir}/hooks/session-init.cjs`), 'session-init should point to runtime');
    assert.ok(runtimeSettings.includes(`${runtimeDir}/hooks/descriptive-name.cjs`), 'descriptive-name should point to runtime');
    assert.ok(runtimeSettings.includes(`${runtimeDir}/hooks/post-edit.cjs`), 'post-edit should point to runtime');
  });

  it('exec validates missing command usage', () => {
    run('init', envOverrides);
    run('create exece -d "Exec Error"', envOverrides);

    const output = run('exec exece --', envOverrides);
    assert.ok(output.includes('Missing command. Usage: csp exec <name> -- <cmd> [args...]'));
  });

  it('resolveExecTarget enables shell for batch commands on Windows', async () => {
    const { resolveExecTarget } = await import('../src/commands/launch.js');

    const direct = resolveExecTarget('node', process.env, {
      isWindows: true,
      execFileSync() {
        return 'C:\\Program Files\\nodejs\\node.exe\r\n';
      },
    });
    const batch = resolveExecTarget('C:\\tools\\script.cmd', process.env, { isWindows: true });

    assert.equal(direct.shell, false);
    assert.equal(batch.shell, true);
    assert.equal(batch.command, 'C:\\tools\\script.cmd');
  });

  it('resolveExecTarget enables shell when where.exe resolves .cmd wrapper', async () => {
    const { resolveExecTarget } = await import('../src/commands/launch.js');

    const target = resolveExecTarget('npm', process.env, {
      isWindows: true,
      execFileSync(command, args) {
        assert.equal(command, 'where.exe');
        assert.deepEqual(args, ['npm']);
        return 'C:\\Users\\tester\\AppData\\Roaming\\npm\\npm.cmd\r\n';
      },
    });

    assert.equal(target.command, 'npm');
    assert.equal(target.shell, true);
  });

  it('resolveExecTarget quotes batch path with spaces on Windows', async () => {
    const { resolveExecTarget } = await import('../src/commands/launch.js');

    const target = resolveExecTarget('C:\\Program Files\\tools\\run.cmd', process.env, { isWindows: true });

    assert.equal(target.command, '"C:\\Program Files\\tools\\run.cmd"');
    assert.equal(target.shell, true);
  });

  it('resolveClaudeLaunchTarget resolves Windows PATH wrapper instead of hardcoded claude.cmd', async () => {
    const { resolveClaudeLaunchTarget } = await import('../src/commands/launch.js');

    const target = resolveClaudeLaunchTarget(
      {
        ...process.env,
        APPDATA: 'C:\\Users\\tester\\AppData\\Roaming',
        USERPROFILE: 'C:\\Users\\tester',
      },
      {
        isWindows: true,
        execFileSync(command, args, options) {
          assert.equal(command, 'where.exe');
          assert.deepEqual(args, ['claude']);
          assert.equal(options.env.APPDATA, 'C:\\Users\\tester\\AppData\\Roaming');
          return [
            'C:\\Users\\tester\\AppData\\Roaming\\npm\\claude',
            'C:\\Users\\tester\\AppData\\Roaming\\npm\\claude.cmd',
          ].join('\r\n');
        },
        existsSync(targetPath) {
          return targetPath === 'C:\\Users\\tester\\AppData\\Roaming\\npm\\claude.cmd';
        },
      },
    );

    assert.equal(target.command, '"C:\\Users\\tester\\AppData\\Roaming\\npm\\claude.cmd"');
    assert.equal(target.shell, true);
  });

  it('stripInheritedLaunchEnv removes inherited Claude session env', async () => {
    const { stripInheritedLaunchEnv } = await import('../src/commands/launch.js');

    const sanitized = stripInheritedLaunchEnv({
      PATH: '/test/bin',
      ANTHROPIC_AUTH_TOKEN: 'secret',
      ANTHROPIC_BASE_URL: 'https://proxy.example.com',
      CLAUDECODE: '1',
      claudecode: '1',
      CLAUDE_CONFIG_DIR: '/tmp/runtime',
      KEEP_ME: 'ok',
    });

    assert.equal(sanitized.PATH, '/test/bin');
    assert.equal(sanitized.KEEP_ME, 'ok');
    assert.equal('ANTHROPIC_AUTH_TOKEN' in sanitized, false);
    assert.equal('ANTHROPIC_BASE_URL' in sanitized, false);
    assert.equal('CLAUDECODE' in sanitized, false);
    assert.equal('claudecode' in sanitized, false);
    assert.equal('CLAUDE_CONFIG_DIR' in sanitized, false);
  });

  it('legacy launch path preserves inherited env semantics', async () => {
    const parentEnv = {
      PATH: '/test/bin',
      ANTHROPIC_AUTH_TOKEN: 'secret',
      CLAUDECODE: '1',
    };

    const isolatedEnv = (await import('../src/commands/launch.js')).stripInheritedLaunchEnv(parentEnv);

    assert.equal('ANTHROPIC_AUTH_TOKEN' in parentEnv, true);
    assert.equal('CLAUDECODE' in parentEnv, true);
    assert.equal('ANTHROPIC_AUTH_TOKEN' in isolatedEnv, false);
    assert.equal('CLAUDECODE' in isolatedEnv, false);
  });
});
