## Test Report

### Scope
- Validate symlink handling fix for default profile init + launch runtime.
- Confirm no regressions in existing profile flows via CLI, core, and full suite coverage.
- No files edited.

### Commands Run
```bash
npm --prefix "/home/work/Desktop/my-project/claude-switch-profile" run test:cli
npm --prefix "/home/work/Desktop/my-project/claude-switch-profile" run test:core
npm --prefix "/home/work/Desktop/my-project/claude-switch-profile" test
```

### Test Results Overview
- CLI integration: Total 48 | Passed 48 | Failed 0 | Skipped 0
- Core library: Total 24 | Passed 24 | Failed 0 | Skipped 0
- Full suite: Total 78 | Passed 78 | Failed 0 | Skipped 0

### Targeted Validation
- init default snapshot preserves symlinked managed items: PASS
  - Test: `init preserves symlinked managed items in the default snapshot`
  - File: `/home/work/Desktop/my-project/claude-switch-profile/tests/cli-integration.test.js`
  - Assertions verify `profiles/default/hooks` remains a symlink and still points to the original target.

- launch runtime preserves managed symlinks: PASS
  - Test: `launch default preserves managed symlinks in runtime config`
  - File: `/home/work/Desktop/my-project/claude-switch-profile/tests/cli-integration.test.js`
  - Assertions verify `.runtime/default/hooks` remains a symlink and still points to the original target.

- existing profile flows regression check: PASS
  - Covered by the full CLI integration suite and full project test suite.
  - Relevant flows still green: init, create, use, save, deactivate, current, export/import, uninstall, launch, legacy/default switching, runtime isolation, and running-process safety checks.

### Build Status
- Success
- No test failures.
- No build step defined in `/home/work/Desktop/my-project/claude-switch-profile/package.json`; validation performed through project test scripts.

### Notes
- CLI output includes expected stderr lines for negative-path tests:
  - missing legacy default snapshot
  - blocked default deletion
  - Claude-running guard
- These are expected fixtures, not failures.

### Coverage Metrics
- No dedicated coverage script is defined in `/home/work/Desktop/my-project/claude-switch-profile/package.json`.
- Coverage not generated in this validation pass.

### Critical Issues
- None.

### Recommendations
- Optional: add a dedicated core-level symlink unit test around lower-level copy/restore helpers so symlink preservation is validated below CLI level too.
- Optional: add a coverage script if branch/line coverage tracking is required for future regression gates.

### Unresolved Questions
- None.
