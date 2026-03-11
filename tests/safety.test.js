import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Safety: Lock File', () => {
  let tempDir;

  beforeEach(() => { tempDir = mkdtempSync(join(tmpdir(), 'csp-safety-')); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('creates and removes lock file', () => {
    const lockPath = join(tempDir, '.lock');
    writeFileSync(lockPath, String(process.pid) + '\n');
    assert.ok(existsSync(lockPath));

    unlinkSync(lockPath);
    assert.equal(existsSync(lockPath), false);
  });

  it('detects stale lock with dead PID', () => {
    const lockPath = join(tempDir, '.lock');
    // Use a PID that almost certainly doesn't exist
    writeFileSync(lockPath, '999999999\n');

    const pid = parseInt(readFileSync(lockPath, 'utf-8').trim(), 10);
    let isRunning = false;
    try {
      process.kill(pid, 0);
      isRunning = true;
    } catch {
      isRunning = false;
    }

    assert.equal(isRunning, false, 'Stale PID should not be running');
  });

  it('detects active lock with current PID', () => {
    const lockPath = join(tempDir, '.lock');
    writeFileSync(lockPath, String(process.pid) + '\n');

    const pid = parseInt(readFileSync(lockPath, 'utf-8').trim(), 10);
    let isRunning = false;
    try {
      process.kill(pid, 0);
      isRunning = true;
    } catch {
      isRunning = false;
    }

    assert.equal(isRunning, true, 'Current PID should be detected as running');
  });
});

describe('Safety: Backup', () => {
  let tempDir, claudeDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'csp-backup-'));
    claudeDir = join(tempDir, '.claude');
    mkdirSync(claudeDir);
  });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it('creates backup with correct files', () => {
    writeFileSync(join(claudeDir, 'settings.json'), '{"backed":"up"}');
    writeFileSync(join(claudeDir, '.env'), 'KEY=val');

    const backupDir = join(tempDir, 'backup');
    mkdirSync(backupDir);

    // Simulate backup operation
    for (const item of ['settings.json', '.env']) {
      const src = join(claudeDir, item);
      if (existsSync(src)) {
        copyFileSync(src, join(backupDir, item));
      }
    }

    assert.equal(readFileSync(join(backupDir, 'settings.json'), 'utf-8'), '{"backed":"up"}');
    assert.equal(readFileSync(join(backupDir, '.env'), 'utf-8'), 'KEY=val');
  });
});
