# Active non-default launch was reading the wrong source of truth

**Date**: 2026-04-02 16:58 (Asia/Saigon)
**Severity**: High
**Component**: Isolated launch runtime seeding (`runtime-instance-manager`)
**Status**: Resolved

## What Happened
`csp launch <profile>` was seeding `.runtime/<profile>/settings.json` from live `~/.claude/settings.json` when that non-default profile was currently active via legacy mode. That broke isolation guarantees and made launch behavior depend on local drift instead of the saved snapshot in `~/.claude-profiles/<profile>/settings.json`.

## The Brutal Truth
This was a painful logic bug, not bad luck. We encoded “active profile” as “read from live ~/.claude” and forgot that this only makes sense for `default`. For non-default profiles, that shortcut quietly corrupted runtime expectations. The frustrating part is we already had tests around launch, just not this exact active-non-default edge.

## Technical Details
- Patched `src/runtime-instance-manager.js`:
  - Added `shouldUseLiveClaudeDir(profileName)`
  - Live `~/.claude` is now allowed only when `profileName === DEFAULT_PROFILE && getActive() === profileName`
- Added regression test in `tests/cli-integration.test.js`:
  - `launch active non-default profile uses stored snapshot instead of live ~/.claude settings`
  - Verifies runtime `settings.json` stays `{"model":"sonnet"}` from profile snapshot, not drifted live `{"model":"haiku"}`.
- Updated `docs/system-architecture.md` and synced plan files under `plans/260402-1642-fix-active-profile-runtime-settings/`.

## What We Tried
1. Keep old active-profile shortcut for all profiles — rejected; reproduces wrong source behavior.
2. Switch all active profiles to snapshot source — rejected; would break the existing active-`default` launch contract.
3. Final decision: gate live source to active `default` only.

## Root Cause Analysis
Root cause: we treated “active” as a universal signal to trust live `~/.claude` instead of profile snapshots. That assumption was wrong and leaked legacy state into isolated runtime launch.

## Lessons Learned
- “Active profile” is not a sufficient predicate; source rules must encode profile type (`default` vs non-default).
- Edge-case integration tests must include drift scenarios between snapshot and live config.

## Next Steps
- **Owner: Maintainer team** — keep the active non-default launch regression test mandatory in release verification for next patch release.
- **Owner: Maintainer team** — consider strengthening the Windows import test branch with a non-symlink assertion for extracted `hooks` if stricter platform documentation is needed.

Status: DONE
Summary: Isolated launch now sources active non-default runtime settings from stored profile snapshots; regression coverage added, the unrelated Windows import test was corrected for tar semantics, and full CLI integration is green.
Concerns/Blockers: None.