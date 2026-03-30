import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
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

describe('CLI Integration', () => {
  let tempDir, claudeDir, profilesDir, envOverrides;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'csp-cli-'));
    claudeDir = join(tempDir, '.claude');
    profilesDir = join(tempDir, '.claude-profiles');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(profilesDir, { recursive: true });

    const fakeBinDir = join(tempDir, 'bin');
    mkdirSync(fakeBinDir, { recursive: true });

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
    run('create myprofile', envOverrides);
    const beforeOutput = run('current', envOverrides);
    assert.ok(beforeOutput.includes('myprofile'));

    run('deactivate', envOverrides);

    // Deactivate resets to default profile (uses ~/.claude directly)
    const afterOutput = run('current', envOverrides);
    assert.ok(afterOutput.includes('default'));

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
    assert.ok(output.includes('Active legacy profile'));
    // default is virtual — no physical directory required
    assert.equal(existsSync(join(profilesDir, 'default')), false);

    const listOutput = run('list', envOverrides);
    assert.ok(listOutput.includes('[legacy]'));
  });

  it('use default from non-default keeps ~/.claude unchanged and snapshots active profile', () => {
    run('init', envOverrides);
    run('create work -d "Work"', envOverrides);
    run('use work --no-save', envOverrides);

    // Simulate live non-default state
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Work live rules');
    writeFileSync(join(claudeDir, 'settings.json'), '{"model":"sonnet"}');

    const beforeClaude = readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8');
    const beforeSettings = readFileSync(join(claudeDir, 'settings.json'), 'utf-8');

    // Switch back to default
    const output = run('use default', envOverrides);
    assert.ok(output.includes('default'));

    // Active should be default
    const current = run('current', envOverrides);
    assert.ok(current.includes('default'));

    // ~/.claude content must remain byte-for-byte unchanged across use default
    assert.equal(readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8'), beforeClaude);
    assert.equal(readFileSync(join(claudeDir, 'settings.json'), 'utf-8'), beforeSettings);

    // Previous non-default profile must receive updated snapshot
    assert.equal(readFileSync(join(profilesDir, 'work', 'CLAUDE.md'), 'utf-8'), beforeClaude);
    assert.equal(readFileSync(join(profilesDir, 'work', 'settings.json'), 'utf-8'), beforeSettings);
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
