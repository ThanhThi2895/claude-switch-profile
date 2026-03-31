## Test Report

### Test Results Overview

- Total: 122 | Passed: 122 | Failed: 0 | Skipped: 0
- Full validation re-run passed.
- Follow-up regression targets both passed.

### Commands Run

- `cd "/home/work/Desktop/my-project/claude-switch-profile" && npm test`
- `cd "/home/work/Desktop/my-project/claude-switch-profile" && node --test --experimental-test-coverage tests/cli-integration.test.js`

### Coverage Metrics

Coverage from the targeted CLI integration coverage run:

- Lines: 82.42%
- Branches: 62.47%
- Functions: 88.60%

Relevant files for the follow-up fixes:

- `src/commands/uninstall.js`: 72.92% lines, 33.33% branches, 66.67% functions
- `src/commands/launch.js`: 86.43% lines, 40.00% branches, 80.95% functions
- `src/profile-store.js`: 94.62% lines, 69.64% branches, 92.31% functions

### Failed Tests

- None.

### Build Status

- Success for the available project validation scope.
- No dedicated build script exists in `/home/work/Desktop/my-project/claude-switch-profile/package.json`.

### Critical Issues

- None found.

### Regression Checks

Confirmed by passing tests:

- `uninstall restores the active non-default profile by default`
- `launch default keeps default profile mode as legacy`
- `uninstall --profile default restores the default snapshot`

### Notes

- `npm test` passed all 76 tests across 10 suites.
- `node --test --experimental-test-coverage tests/cli-integration.test.js` passed all 46 CLI integration tests.
- The output still prints expected guard-rail error lines for negative-path assertions; these are expected and not failures.
- No flaky behavior observed across the two validation runs.

### Recommendations

- QA status: pass for the real-default-profile follow-up fixes.

### Unresolved Questions

- None.
