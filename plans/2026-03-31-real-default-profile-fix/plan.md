---
title: "Fix: Make default a real profile snapshot"
description: "Replace virtual default pass-through with a physical default profile plus safe migration for old installs missing default/."
status: completed
priority: P1
effort: "4h"
branch: "fix/real-default-profile"
tags: [bugfix, migration]
created: 2026-03-31
---

# Fix: Make default a real profile snapshot

## Overview

Status: Complete
Progress: 100%

Current code treated `default` as a virtual alias to `~/.claude`, but docs and user expectation treated it as a real baseline profile. This mismatch caused `csp use default` to restore nothing and let the default state drift after switching profiles.

Implemented state: `default` now exists as a physical profile created at `csp init`, restores like any other profile, preserves symlinked managed items in the stored snapshot/runtime flow, and only auto-migrates when the current state is unambiguous.

Validation: `npm test` and targeted CLI integration re-validation passed per `plans/reports/tester-2026-03-31-real-default-profile-validation.md`, with follow-up regression coverage for symlink preservation and default launch runtime behavior.

## Issue Analysis

### Symptoms
- `csp init` does not create `~/.claude-profiles/default/`
- `csp use default` skips restore, so it cannot return to the original baseline
- Existing docs say init captures `default`, while tests assert `default` is virtual

### Root Cause
`src/commands/init.js` writes only metadata for `default`, while `src/profile-store.js` and multiple commands special-case `default` as always-existing pass-through state. That design leaks into `use`, `save`, `export`, `launch`, and runtime sync logic.

### Evidence
- **Behavior gap**: `src/commands/init.js`, `src/commands/use.js`, `src/profile-store.js`
- **Runtime gap**: `src/commands/launch.js`, `src/runtime-instance-manager.js`
- **Docs/tests mismatch**: `README.md`, `docs/system-architecture.md`, `tests/cli-integration.test.js`
- **Prior design to supersede**: `plans/260325-default-multilaunch-perf/plan.md`, `plans/reports/brainstorm-2026-03-31-default-profile-baseline.md`

## Phase 1: Real default snapshot + safe migration — create physical `default/`, remove fake existence, add guarded backfill path

> [phase-01-default-snapshot-and-migration.md](phase-01-default-snapshot-and-migration.md)

- Status: Complete
- Progress: 100%
- [x] Done

## Phase 2: Align switch, save, export, launch, and runtime flows — treat `default` like a normal profile everywhere practical

> [phase-02-command-and-runtime-alignment.md](phase-02-command-and-runtime-alignment.md)

- Status: Complete
- Progress: 100%
- [x] Done
Depends on: Phase 1

## Phase 3: Regression and migration tests — replace virtual-default assertions and cover safe/unsafe upgrade cases

> [phase-03-regression-tests-and-migration-coverage.md](phase-03-regression-tests-and-migration-coverage.md)

- Status: Complete
- Progress: 100%
- [x] Done
Depends on: Phase 2

## Phase 4: Docs and release notes — update user-facing semantics and note migration behavior

> [phase-04-docs-and-release-notes.md](phase-04-docs-and-release-notes.md)

- Status: Complete
- Progress: 100%
- [x] Done
Depends on: Phase 3

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auto-migrating old installs while a non-default profile is active snapshots the wrong state | High | Only auto-backfill when active profile is `default` or no active profile; otherwise fail with explicit repair guidance |
| Removing default special-cases breaks commands that assumed `default` always maps to `~/.claude` | High | Update all command paths in one pass and lock behavior with integration tests |
| Launch/runtime behavior silently changes for `default` | Medium | Make `launch default` read from the real profile snapshot, document the new semantics, test active/inactive cases |
| Existing users rely on `save default` no-op behavior | Medium | Document behavior change; preserve explicit delete protection for `default` |

## Rollback Plan

If this fix causes regressions:
1. Revert the implementation commit.
2. Restore the prior default-pass-through behavior in `src/profile-store.js`, `src/commands/use.js`, `src/commands/launch.js`, and `src/runtime-instance-manager.js`.
3. Re-run CLI integration tests for `init`, `use`, `launch`, `export`, and migration paths.

## Files Affected

### Update
- `src/commands/init.js`
- `src/profile-store.js`
- `src/commands/use.js`
- `src/commands/deactivate.js`
- `src/commands/save.js`
- `src/commands/export.js`
- `src/commands/uninstall.js`
- `src/commands/launch.js`
- `src/runtime-instance-manager.js`
- `src/commands/diff.js`
- `src/commands/current.js`
- `tests/cli-integration.test.js`
- `README.md`
- `docs/system-architecture.md`
- `docs/project-overview-pdr.md`
- `docs/codebase-summary.md`
- `CHANGELOG.md`

### Tests
- `tests/cli-integration.test.js`
