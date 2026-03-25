# Phase 3: Simplify Launch Command

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 30m

Remove auto-restore from launch. Make launch = switch + spawn. Skip `warnIfClaudeRunning()` (saves ~140ms on Windows). Enables multi-instance without conflicts.

## Related Code Files

- **Modify:** `src/commands/launch.js` — remove restorePrevious, simplify to switch+spawn
- **Modify:** `src/commands/use.js` — already has `skipClaudeCheck` option, launch passes it

## Implementation Steps

### 1. Simplify launch.js

Remove `restorePrevious()` function entirely. New flow:

```js
export const launchCommand = async (name, claudeArgs, _options) => {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const active = getActive();
  
  // Switch to target profile (if not already active)
  // skipClaudeCheck: launch intentionally runs Claude, skip tasklist (~140ms)
  if (active !== name) {
    await useCommand(name, { save: true, skipClaudeCheck: true });
  }

  // Launch Claude with forwarded args
  const args = claudeArgs || [];
  info(`Launching: claude ${args.join(' ')}`.trim());

  const child = spawn('claude', args, {
    stdio: 'inherit',
    shell: false,
    detached: false,
  });

  child.on('error', (err) => {
    error(`Failed to launch Claude: ${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Keep process alive
  return new Promise(() => {});
};
```

### 2. Remove deactivate import

Remove unused `deactivateCommand` import.

### 3. Update help text

Update launch description to clarify no auto-restore:
```
'Switch to a profile and launch Claude Code (profile stays active after exit)'
```

## Behavior Change

| Scenario | Before | After |
|---|---|---|
| `csp launch X` exits | Restores previous profile | Profile X stays active |
| 2nd `csp launch X` | Warning about Claude running | Just spawns another Claude |
| `csp launch X` then `csp launch Y` | Conflict on restore | Y switch overwrites X (expected) |

## Performance Impact

`warnIfClaudeRunning()` calls `tasklist` on Windows = ~140ms overhead. Skipped via `skipClaudeCheck: true` since launch intentionally spawns Claude.

```
Launch flow after all fixes:
  Node startup          ~50ms
  useCommand (rename)   ~250ms  (was 27s)
  spawn claude          ~0ms
  ────────────────────
  Total:                ~300ms  (was 27s+)
```

## Success Criteria

- `csp launch X` switches and spawns Claude
- After Claude exits, profile remains X (no auto-restore)
- Second `csp launch X` spawns another Claude without errors
- Signal forwarding (SIGINT/SIGTERM) still works

## Risk Assessment

- **Low:** Breaking change — users relying on auto-restore must manually `csp use <prev>`. This is acceptable since the old behavior caused more problems than it solved.
