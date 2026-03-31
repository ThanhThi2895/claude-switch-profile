# Phase 1: Real default snapshot + safe migration

> Plan: `plans/2026-03-31-real-default-profile-fix/plan.md`
> Depends on: None
> Parallel-safe: No — establishes the core storage semantics every later phase depends on

---

## Objective

Status: Complete
Progress: 100%

Make `default` a physical profile created during `init`, then add a guarded migration path for existing installs that only have virtual-default metadata.

## Context Links

- `plans/reports/brainstorm-2026-03-31-default-profile-baseline.md`
- `plans/260325-default-multilaunch-perf/phase-02-default-passthrough.md`
- `src/commands/init.js`
- `src/profile-store.js`

## Key Insights

- The current bug exists because metadata says `default` exists while the filesystem does not.
- Migration is only safe when `~/.claude` actually represents the intended default state; if a non-default profile is active, the tool cannot infer the old baseline.

---

## Task List

### Task 1.1 — Create physical `default/` during init

- [x] Complete
- **File**: `src/commands/init.js`
- **Action**: Replace metadata-only init with real snapshot creation: create `~/.claude-profiles/default/`, write `source.json`, copy managed items/files/dirs, preserve symlinked managed items as links, then mark `default` active.
- **Sync-back**: `init` now ensures metadata exists, materializes the default snapshot, preserves symlinked managed items, and reports the physical default directory.
- **Test**: `tests/cli-integration.test.js` — `init` creates physical `default/` with `source.json`, managed baseline files, and preserved symlinked managed items.

### Task 1.2 — Remove fake existence semantics for `default`

- [x] Complete
- **File**: `src/profile-store.js`
- **Action**: Stop returning `true` for `profileExists('default')` when the directory is missing; keep `getEffectiveDir()` based on active profile location rather than `DEFAULT_PROFILE` special-casing.
- **Sync-back**: `profileExists()` now checks the real directory; `getEffectiveDir()` now uses active-profile state only.
- **Test**: `tests/cli-integration.test.js` — commands fail clearly if the default snapshot is genuinely missing.

### Task 1.3 — Add guarded backfill/migration path

- [x] Complete
- **File**: `src/profile-store.js`
- **Action**: Add a small helper to detect "legacy virtual default" and backfill `default/` only when active is `default` or there is no active profile; otherwise surface a hard error with repair guidance instead of snapshotting the wrong profile.
- **Sync-back**: `ensureDefaultProfileSnapshot()` backfills only for safe legacy states and fails closed for ambiguous active non-default installs.
- **Test**: `tests/cli-integration.test.js` — covers safe backfill and blocked migration when active is non-default.

### Task 1.4 — Fix default location messaging

- [x] Complete
- **File**: `src/commands/current.js`
- **Action**: Ensure `current` reports the real profile directory for `default` after migration/initialization and does not imply the profile is virtual.
- **Sync-back**: `current` now ensures the default snapshot exists before printing the active location and shows `profiles/default`.
- **Test**: `tests/cli-integration.test.js` — `current` shows `profiles/default` after init.

---

## Security Considerations

- Never auto-snapshot `~/.claude` into `default/` when a non-default profile is active; that would silently rewrite baseline state.
- Keep the existing protected-item exclusions intact while creating `default/` so credentials/session data stay out of profile storage.

## Expected Outcome

- `csp init` always creates a real `default` snapshot.
- Upgraded installs backfill `default/` only when safe.
- Ambiguous installs fail with repair guidance instead of corrupting the baseline.

---

_Phase created per Luna AI workflow — template: `~/.claude/templates/plans/phase.md`_
