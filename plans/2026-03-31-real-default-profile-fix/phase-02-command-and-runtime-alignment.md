# Phase 2: Align switch, save, export, launch, and runtime flows

> Plan: `plans/2026-03-31-real-default-profile-fix/plan.md`
> Depends on: Phase 1
> Parallel-safe: No — all command flows must agree on the same default semantics

---

## Objective

Status: Complete
Progress: 100%

Remove virtual-default assumptions from command and runtime paths so `default` behaves like a real profile snapshot across legacy switching and isolated launch flows.

## Context Links

- `src/commands/use.js`
- `src/commands/deactivate.js`
- `src/commands/save.js`
- `src/commands/export.js`
- `src/commands/uninstall.js`
- `src/commands/launch.js`
- `src/runtime-instance-manager.js`
- `src/commands/diff.js`

## Key Insights

- The bug is not just `init`; `default` is special-cased throughout the codebase.
- If `launch default` keeps reading live `~/.claude`, the repo will still have two conflicting meanings of `default`.

---

## Task List

### Task 2.1 — Make `use` restore `default` like any other profile

- [x] Complete
- **File**: `src/commands/use.js`
- **Action**: Remove skip-save/skip-restore branches tied to `DEFAULT_PROFILE`; keep the normal save/remove/restore path so switching away from and back to `default` preserves the profile snapshot instead of using pass-through behavior. Align `deactivate` with the same model by routing it through `use default` instead of only flipping active metadata.
- **Sync-back**: `use` now validates and restores `default` like any other profile, while ensuring the legacy default snapshot exists before use. `deactivate` now restores the real default snapshot instead of leaving `~/.claude` untouched.
- **Test**: `tests/cli-integration.test.js` — `default -> work -> default` restores the original default baseline; edits made while `default` is active are saved when expected; deactivate-to-default behavior is covered.

### Task 2.2 — Remove no-op handling for `save default`

- [x] Complete
- **File**: `src/commands/save.js`
- **Action**: Let `save` persist `default` like any real profile instead of returning early.
- **Sync-back**: `save` now persists the active default snapshot after ensuring legacy backfill state is safe.
- **Test**: `tests/cli-integration.test.js` — `save` while `default` is active updates `profiles/default`.

### Task 2.3 — Re-enable export and uninstall semantics for a real default profile

- [x] Complete
- **File**: `src/commands/export.js`
- **Action**: Allow exporting `default`; if `default` is active, snapshot current state before creating the archive.
- **Sync-back**: `export default` is now allowed after snapshot verification and exports the real physical profile.
- **Test**: `tests/cli-integration.test.js` — `export default` succeeds and produces an archive.

### Task 2.4 — Restore `default` correctly during uninstall

- [x] Complete
- **File**: `src/commands/uninstall.js`
- **Action**: Treat `default` like any other restorable profile, only skipping copy-back when `default` is already the active profile and its files are already in `~/.claude`.
- **Sync-back**: uninstall now removes managed items then restores the selected profile, including `default`, from the stored snapshot.
- **Test**: `tests/cli-integration.test.js` — uninstall with `--profile default` restores the default snapshot correctly.

### Task 2.5 — Remove runtime/launch pass-through logic for `default`

- [x] Complete
- **File**: `src/commands/launch.js`
- **Action**: Remove the `DEFAULT_PROFILE` branch so `launch default` resolves through the normal per-profile runtime flow.
- **Sync-back**: `launch default` now only special-cases legacy snapshot verification, then uses standard runtime setup.
- **Test**: `tests/cli-integration.test.js` — `launch default -- --version` seeds runtime metadata and uses default snapshot data whether active or inactive.

### Task 2.6 — Align runtime source resolution and diff behavior

- [x] Complete
- **File**: `src/runtime-instance-manager.js`
- **Action**: Remove `DEFAULT_PROFILE` special-cases from `resolveSourceDir()` / `resolveItemSource()` and rely only on whether the profile is currently active.
- **Sync-back**: runtime source resolution now depends on active/inactive state, not the profile name.
- **Test**: `tests/cli-integration.test.js` — launching an inactive `default` uses `profiles/default`; launching an active `default` uses `~/.claude`.

### Task 2.7 — Keep comparison behavior consistent

- [x] Complete
- **File**: `src/commands/diff.js`
- **Action**: Verify diff behavior still reads from `~/.claude` only for the active profile, not because the name is `default`.
- **Sync-back**: `diff` now compares stored `source.json` manifests from real profile dirs and still uses live state only for the active tree.
- **Test**: `tests/cli-integration.test.js` — `diff current default` returns stable results for active default.

---

## Security Considerations

- Preserve existing lock/check behavior in `use` and `uninstall`; this refactor must not weaken concurrency protection.
- Continue excluding protected runtime/session paths when exporting or launching the default profile.

## Expected Outcome

- `default` is no longer a pass-through special case.
- `use`, `save`, `export`, `uninstall`, `launch`, runtime sync, and `diff` all agree on one model.
- Switching and isolated launching behave predictably for `default`.

---

_Phase created per Luna AI workflow — template: `~/.claude/templates/plans/phase.md`_
