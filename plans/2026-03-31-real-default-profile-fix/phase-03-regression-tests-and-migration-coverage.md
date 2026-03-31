# Phase 3: Regression and migration tests

> Plan: `plans/2026-03-31-real-default-profile-fix/plan.md`
> Depends on: Phase 2
> Parallel-safe: Yes — test additions are isolated to test files once command behavior is defined

---

## Objective

Status: Complete
Progress: 100%

Replace virtual-default assertions with real-profile expectations and lock the migration behavior with regression coverage.

## Context Links

- `tests/cli-integration.test.js`
- `plans/reports/brainstorm-2026-03-31-default-profile-baseline.md`

## Key Insights

- Current tests explicitly encode the bug by asserting `profiles/default` must not exist.
- Migration coverage is mandatory; without it, upgrades can silently regress or snapshot the wrong state.

---

## Task List

### Task 3.1 — Update init/default assertions

- [x] Complete
- **File**: `tests/cli-integration.test.js`
- **Action**: Replace virtual-default checks with assertions that `init` creates `profiles/default`, writes `source.json`, and reports the real directory in `current`.
- **Sync-back**: integration coverage now asserts physical `default/`, `source.json`, and real-directory reporting from `current`.
- **Test**: `tests/cli-integration.test.js` — `init creates physical default profile and sets it active`.

### Task 3.2 — Add switch/save regression coverage for real default

- [x] Complete
- **File**: `tests/cli-integration.test.js`
- **Action**: Cover `default -> non-default -> default`, `save default`, and edits made while default is active so baseline restoration is proven instead of assumed.
- **Sync-back**: coverage now includes switching away from and back to `default`, saving the default snapshot, and deactivate-to-default behavior.
- **Test**: `tests/cli-integration.test.js` — new scenarios around `use`, `save`, `deactivate`, and `current`.

### Task 3.3 — Add migration safety tests

- [x] Complete
- **File**: `tests/cli-integration.test.js`
- **Action**: Simulate old installs where metadata contains `default` but `profiles/default` is missing; verify safe backfill when active is `default` and explicit failure when active is non-default.
- **Sync-back**: tests now lock both safe backfill and fail-closed blocked migration.
- **Test**: `tests/cli-integration.test.js` — dedicated migration cases added.

### Task 3.4 — Add launch/export coverage for default

- [x] Complete
- **File**: `tests/cli-integration.test.js`
- **Action**: Verify `launch default` writes runtime metadata, preserves symlinked managed items in runtime config, and `export default` works with the new physical-profile model.
- **Sync-back**: tests now cover export, active/inactive `launch default`, symlink preservation in runtime/default snapshot flows, uninstall restore, and default mode preservation.
- **Test**: `tests/cli-integration.test.js` — launch/export/uninstall scenarios for default plus symlink-preservation regressions.

### Task 3.5 — Run the full project test suite

- [x] Complete
- **File**: `package.json`
- **Action**: Use the existing test script during implementation validation; do not stop at single-case CLI tests.
- **Sync-back**: validated by tester report: `npm test` and targeted CLI integration re-run both passed.
- **Test**: `npm test` — full suite green; targeted CLI re-validation green.

---

## Security Considerations

- Migration tests must verify that ambiguous installs fail closed instead of auto-capturing potentially sensitive wrong-profile state.
- Export tests must confirm the protected-item exclusions still hold for the default profile archive path.

## Expected Outcome

- The test suite encodes the new real-default model.
- Upgrade behavior is covered and deterministic.
- Future regressions toward virtual-default semantics fail fast in CI.

---

_Phase created per Luna AI workflow — template: `~/.claude/templates/plans/phase.md`_
