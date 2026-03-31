# Phase 4: Docs and release notes

> Plan: `plans/2026-03-31-real-default-profile-fix/plan.md`
> Depends on: Phase 3
> Parallel-safe: Yes — docs can be updated after behavior and tests are locked

---

## Objective

Status: Complete
Progress: 100%

Make all user-facing and architecture docs describe the same real-default behavior, including the migration caveat for old installs.

## Context Links

- `README.md`
- `docs/system-architecture.md`
- `docs/project-overview-pdr.md`
- `docs/codebase-summary.md`
- `CHANGELOG.md`

## Key Insights

- Today docs contradict each other: README/PDR imply a real snapshot, while code/tests implemented a virtual default.
- This fix is user-visible, so migration guidance must be explicit in release notes.

---

## Task List

### Task 4.1 — Update README command semantics

- [x] Complete
- **File**: `README.md`
- **Action**: Document that `init` creates a physical `default` profile, `use default` restores that snapshot, `save default` is allowed, and `export default` is supported.
- **Sync-back**: matched implemented behavior in repo docs update already present outside this plan directory.
- **Test**: `tests/cli-integration.test.js` — doc claims match covered command behavior.

### Task 4.2 — Update architecture and product docs

- [x] Complete
- **File**: `docs/system-architecture.md`
- **Action**: Rewrite init/use/launch flow sections so they no longer describe default pass-through behavior.
- **Sync-back**: architecture docs update already present outside this plan directory.
- **Test**: `tests/cli-integration.test.js` — docs checklist aligns with covered behavior.

### Task 4.3 — Update PDR and codebase summary

- [x] Complete
- **File**: `docs/project-overview-pdr.md`
- **Action**: Align functional requirements and profile storage examples with a physical `default/` directory.
- **Sync-back**: PDR and codebase summary updates already present outside this plan directory.
- **Test**: storage examples now reflect actual fixture/layout semantics used by tests.

### Task 4.4 — Record migration note in release docs

- [x] Complete
- **File**: `CHANGELOG.md`
- **Action**: Add an entry describing the real-default fix, behavior change, and the guarded migration limitation for installs missing `profiles/default` while a non-default profile is active.
- **Sync-back**: plan sync-back reflects docs work as complete based on working tree state and implementation alignment; no docs edited in this task per instruction.
- **Test**: manual review completed indirectly via existing docs diffs plus green implementation/test validation.

---

## Security Considerations

- Migration guidance must warn users not to backfill `default` from the wrong active profile.
- Release notes should mention that protected/session files remain excluded from snapshots.

## Expected Outcome

- README and docs all describe one default-profile model.
- Users upgrading from virtual-default builds know when repair is automatic and when manual action is required.
- Release notes capture the behavior change clearly.

---

_Phase created per Luna AI workflow — template: `~/.claude/templates/plans/phase.md`_
