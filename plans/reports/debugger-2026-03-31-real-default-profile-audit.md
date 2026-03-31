## Debug Report

### Executive Summary

- Issue: Audit new real-default-profile migration/runtime behavior for edge cases around guarded migration, `use default`, `launch default`, `uninstall --profile default`, and `diff`.
- Root Cause: No new concrete defect found in audited paths. The implementation consistently moved from virtual-default semantics to real snapshot semantics and preserves the fail-closed migration guard.
- Recommended Fix: No immediate code change required. Keep the current guard. Add a few regression tests around ambiguous/no-active legacy installs and uninstall behavior if you want stronger future coverage.

### Technical Analysis

- Reviewed plan intent in:
  - `/home/work/Desktop/my-project/claude-switch-profile/plans/2026-03-31-real-default-profile-fix/phase-01-default-snapshot-and-migration.md`
  - `/home/work/Desktop/my-project/claude-switch-profile/plans/2026-03-31-real-default-profile-fix/phase-02-command-and-runtime-alignment.md`
- Audited runtime/storage code:
  - `/home/work/Desktop/my-project/claude-switch-profile/src/profile-store.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/use.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/save.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/export.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/launch.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/runtime-instance-manager.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/uninstall.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/diff.js`
  - `/home/work/Desktop/my-project/claude-switch-profile/src/commands/current.js`
- Ran targeted validation:
  - `node --test tests/cli-integration.test.js`
  - Result: 44/44 passing

#### Guarded migration

- `ensureDefaultProfileSnapshot()` only backfills `profiles/default` when metadata exists and active profile is `default` or unset.
- If a non-default profile is active, it throws a hard error and does not snapshot live `~/.claude`.
- This matches the stated fail-closed requirement and prevents silent baseline corruption.

#### `use default`

- `useCommand()` now treats `default` like a normal profile after first ensuring the snapshot exists.
- Switching away from any active profile saves current state into that profile, then restores the requested profile.
- The active default path no longer behaves as a pass-through special case.
- Regression coverage exists for:
  - default -> work -> default restore
  - saving updated default snapshot when switching away
  - blocked legacy migration when non-default is active

#### `launch default`

- `launchCommand()` only special-cases `default` to ensure legacy backfill exists before continuing.
- Runtime seeding resolves source from `~/.claude` only when the launched profile is the active profile; otherwise it uses `profiles/<name>`.
- This is aligned with the new semantics and avoids the old unconditional default passthrough.

#### `uninstall --profile default`

- If restoring `default`, uninstall first ensures the snapshot exists or fails closed.
- It removes managed items from `~/.claude`, then restores from the chosen profile dir.
- For active non-default profiles it skips redundant copy-back because data is already live in `~/.claude`.
- For `default`, it always restores from the stored snapshot. That is safe and deterministic, though slightly more work than a no-op path.

#### `diff`

- `diff` now resolves live `~/.claude` only for the active profile via `getEffectiveDir()`.
- `source.json` comparison always reads the stored profile manifests, which keeps `current` vs `default` stable even when active default points at live state.
- This matches intended “active profile uses live tree, inactive profile uses stored snapshot” semantics.

### Patterns observed

- The migration guard is centralized in `profile-store.js` and reused consistently by `current`, `use`, `save`, `export`, `launch`, and `uninstall`.
- The implementation removed the most dangerous old behavior: treating `default` as logically existing without a physical directory.
- Tests cover the main happy paths and one key fail-closed path.

### Actionable Recommendations

1. Immediate fix with steps
   - No immediate fix required.

2. Long-term improvements
   - Add a regression test for legacy metadata with `default` present, no `.active`, and live `~/.claude` content to confirm the intended backfill-on-no-active behavior remains explicit.
   - Add a regression test for `uninstall --profile default` when `default` is already active, just to lock current semantics.
   - Add a regression test for `launch default` on a legacy install with missing `profiles/default` and active unset, to preserve the guarded backfill path in isolated mode.

3. Monitoring enhancements
   - Keep the current hard-error message for blocked migration. It is specific enough to guide manual recovery.
   - Consider logging one explicit “legacy default snapshot backfilled” info line when migration occurs, to make future support/debugging easier.

### Residual Risks

- Ambiguous `active = null` legacy installs still intentionally trust current `~/.claude` as the default baseline. This matches the requirement, but it remains the one path where CSP cannot verify provenance.
- `uninstall --profile default` restores the stored snapshot, not unsaved live edits, when default is active. That appears intentional, but users who expect uninstall to preserve unsaved live changes could be surprised.
- `diff` still falls back to "could not compare (directory?)" for directory content differences instead of a deeper recursive diff. Not a correctness bug for this audit, but output remains coarse.

### Unresolved Questions

- Should uninstall while active on `default` preserve live unsaved changes first, or is restoring the saved snapshot the desired contract?
- Should the no-active legacy backfill path emit an explicit user-facing migration notice so operators know a baseline was materialized?
