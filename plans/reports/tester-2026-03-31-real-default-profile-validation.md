## Test Report

### Test Results Overview

- Total: 118 | Passed: 118 | Failed: 0 | Skipped: 0
- Independent re-validation completed on the current `main` worktree.

### Commands Run

- `npm test`
- `node --test --experimental-test-coverage tests/cli-integration.test.js`
- `node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts).join('\n'))"`

### Coverage Metrics

Coverage from the targeted CLI integration run:

- Lines: 82.22%
- Branches: 61.78%
- Functions: 88.36%

Notable coverage for default-profile paths:

- `src/commands/init.js`: 83.72% lines
- `src/commands/use.js`: 81.90% lines
- `src/commands/deactivate.js`: 85.00% lines
- `src/commands/current.js`: 79.31% lines
- `src/commands/launch.js`: 86.43% lines
- `src/profile-store.js`: 94.57% lines

### Relevant Validation Findings

Validated the real default profile behavior via passing CLI integration cases covering:

- `init` creates a physical `default` profile and marks it active.
- `use default` restores saved baseline and snapshots the previously active profile.
- Switching away from active `default` saves the updated default snapshot.
- `save` while `default` is active updates the stored default snapshot.
- `deactivate` returns to the stored default snapshot.
- Legacy migration path backfills missing default snapshot when safe.
- Fail-closed behavior triggers when legacy default snapshot is missing and a non-default profile is active.
- `launch default` uses live active state when default is active, and stored snapshot when inactive.
- `uninstall --profile default` restores the default snapshot.
- `delete default` remains blocked.

The `npm test` output prints expected user-facing error lines for guarded negative-path tests, but all assertions passed.

### Build Status

- No dedicated build script is defined in `/home/work/Desktop/my-project/claude-switch-profile/package.json`.
- Available verification scripts are limited to test targets: `test`, `test:core`, `test:cli`, `test:safety`.
- Test-based validation succeeded.

### Critical Issues

- None found.

### Recommendations

- Current implementation is stable for the real default profile flow based on regression coverage.
- If branch coverage matters for release gates, add focused tests for lower-covered command modules such as `select.js`, `status.js`, `toggle.js`, and some error branches in `create.js` / `delete.js` / `uninstall.js`.

### Unresolved Questions

- None.
