# Phase 4: Tests & Validation

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 30m

Update existing tests, add new tests for move/rename and default pass-through.

## Related Code Files

- **Modify:** `tests/core-library.test.js` — update save/restore tests for move semantics
- **Modify:** `tests/cli-integration.test.js` — add default pass-through tests, multi-launch test
- **Modify:** `tests/safety.test.js` — update backup test (no MANAGED_ITEMS in backup)

## Implementation Steps

### 1. Update core-library tests

Test `saveItems()` move behavior:
- After saveItems(profileDir): items exist in profileDir, NOT in CLAUDE_DIR
- source.json written correctly

Test `restoreItems()` move behavior:
- After restoreItems(profileDir): items exist in CLAUDE_DIR, NOT in profileDir
- source.json still readable in profileDir

### 2. Add default pass-through tests

```js
test('use default skips restore', async () => {
  // Setup: create profile "work", switch to it
  // Action: csp use default
  // Assert: active = default, managed items removed, no restore attempted
});

test('use X from default skips save', async () => {
  // Setup: active = default, create profile "work" with items
  // Action: csp use work
  // Assert: active = work, items restored, no save of default
});

test('save on default is no-op', () => {
  // Setup: active = default
  // Action: csp save
  // Assert: no error, no file changes
});
```

### 3. Add move/rename fallback test

```js
test('cross-device fallback uses filtered copy', () => {
  // Setup: CSP_PROFILES_DIR on different mount (or mock renameSync to throw EXDEV)
  // Action: saveItems(profileDir)
  // Assert: items copied (without .venv, node_modules), source deleted
});
```

### 4. Update safety tests

- Backup should only contain COPY_ITEMS, not MANAGED_ITEMS
- Backup size should be small (<1MB)

### 5. Performance validation

Add manual perf test (not in CI):
```bash
# Windows PowerShell
Measure-Command { node bin/csp.js use default --no-save } | Select-Object TotalMilliseconds
# Expected: < 500ms
```

## Success Criteria

- All existing tests pass with updated assertions
- New default pass-through tests pass
- `npm test` green
- Manual perf test: `csp use` < 1s on Windows
