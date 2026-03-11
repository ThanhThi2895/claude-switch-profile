# Phase 4: Safety & Polish

> Plan: `plans/2026-03-11-claude-switch-profile/plan.md`
> Depends on: Phase 3
> Parallel-safe: No — enhances existing commands

---

## Objective

Add safety features: auto-backup, lock file for concurrent switch prevention, Claude process detection, and init flow for first-time users.

---

## Task List

### Task 4.1 — Safety utilities module

- **File**: `src/safety.js`
- **Action**: Create module with functions:
  - `acquireLock()` — create lock file, error if exists (with PID check for stale locks)
  - `releaseLock()` — remove lock file
  - `withLock(fn)` — wrapper that acquires/releases around async function
  - `isClaudeRunning()` — check if `claude` process is running via `pgrep` or `/proc`
  - `warnIfClaudeRunning()` — print warning if Claude detected, suggest restarting session
  - `createBackup()` — copy current managed items to .backup/ dir with timestamp
- **Test**: Lock/unlock cycle, stale lock detection

### Task 4.2 — Integrate safety into `use` command

- **File**: `src/commands/use.js`
- **Action**: Wrap switch in `withLock()`. Call `warnIfClaudeRunning()` before switch. Call `createBackup()` before removing current config.
- **Test**: Concurrent switch attempt — should fail with lock error

### Task 4.3 — Init flow for first-time users

- **File**: `src/commands/init.js`
- **Action**: Create `csp init` command:
  - Check if ~/.claude-profiles exists
  - If not: create dir, create "default" profile from current state, set as active
  - If exists: show status (profiles count, active profile)
  - Auto-trigger on first `csp` run if profiles dir missing
- **Test**: Fresh init creates default profile

### Task 4.4 — Error handling and user feedback

- **File**: `src/output-helpers.js`
- **Action**: Create helper functions:
  - `success(msg)` — green checkmark + message
  - `warn(msg)` — yellow warning + message
  - `error(msg)` — red X + message
  - `info(msg)` — blue info + message
  - `table(rows)` — formatted table output
- **Test**: Visual output verification

---

## Expected Outcome

- Lock file prevents concurrent switches
- Claude process detection warns users
- First-time users get guided init flow
- All output is consistent and colored
