# Phase 5: Testing

> Plan: `plans/2026-03-11-claude-switch-profile/plan.md`
> Depends on: Phase 4
> Parallel-safe: No — tests all modules

---

## Objective

Write unit tests for core library and integration tests for CLI commands using Node.js built-in test runner.

---

## Task List

### Task 5.1 — Core library unit tests

- **File**: `tests/core-library.test.js`
- **Action**: Test profile-store, symlink-manager, file-operations, profile-validator:
  - Profile CRUD operations with temp directories
  - Symlink create/remove/restore cycle
  - File copy operations with missing files
  - Validation of good/bad profiles
  - Use `node:test` and `node:assert` (built-in, no deps)
  - Use `fs.mkdtempSync` for isolated test dirs
- **Test**: `node --test tests/core-library.test.js`

### Task 5.2 — CLI integration tests

- **File**: `tests/cli-integration.test.js`
- **Action**: Test CLI commands end-to-end:
  - `csp init` creates profiles dir and default profile
  - `csp create test` creates profile from current state
  - `csp list` shows created profiles
  - `csp current` shows active profile
  - `csp use test` switches profile
  - `csp save` updates profile
  - `csp delete` removes profile
  - Use `child_process.execSync` to run CLI commands
  - Override PROFILES_DIR via env var for test isolation
- **Test**: `node --test tests/cli-integration.test.js`

### Task 5.3 — Safety module tests

- **File**: `tests/safety.test.js`
- **Action**: Test lock file, backup, Claude process detection:
  - Lock acquisition and release
  - Stale lock detection and cleanup
  - Backup creation with correct files
- **Test**: `node --test tests/safety.test.js`

---

## Expected Outcome

- All tests pass with `node --test tests/`
- No external test dependencies (uses built-in node:test)
- Tests use temp directories for isolation
- Test coverage for all critical paths
