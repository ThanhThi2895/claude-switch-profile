# Plan Validation Report

**Plan:** `plans/260325-default-multilaunch-perf/`
**Date:** 2026-03-25
**Verdict:** ⚠️ 5 CRITICAL GAPS FOUND — plan needs revision

---

## Gaps Found

### GAP 1: `create.js` calls internal copy logic, NOT saveItems — but still writes source.json [MEDIUM]

**Issue:** Plan says "csp create still copies" but doesn't address that `create.js` currently does its own copy loop (lines 82-127) and writes source.json directly. It does NOT call `saveItems()`. After Phase 1 changes saveItems to use rename, create.js is unaffected — BUT if someone later refactors create.js to reuse saveItems, it would MOVE items out of ~/.claude during create.

**Resolution:** Add explicit note in Phase 1: create.js has its own copy logic (intentional — create must NOT move). Add `copyItems(profileDir)` function as read-only alternative to `saveItems()` for use by create/export/diff.

### GAP 2: `csp diff` broken for active profile [CRITICAL]

**Issue:** After rename, active profile's profileDir has NO item files (only source.json). `diff.js` reads profileDir directly to list files and compare content.

`csp diff current X` → resolves "current" to active name → reads empty profileDir → shows everything as "only in X".

**Resolution:** diff.js must detect if target is active profile → read from ~/.claude instead of profileDir. OR require `csp save` before diff (bad UX). Recommend: add helper `getEffectiveDir(name)` that returns CLAUDE_DIR if name is active, else profileDir.

### GAP 3: `csp export` broken for active profile [CRITICAL]

**Issue:** `export.js` tars profileDir directly. If profile is active, profileDir is nearly empty after rename (only source.json).

**Resolution:** export.js must either:
1. Auto-save before export (but save = move, breaks ~/.claude), OR
2. Copy items to a temp dir, then tar, OR
3. Use `getEffectiveDir()` — tar from ~/.claude if active

Recommend option 3: tar from ~/.claude when exporting active profile. Need to handle NEVER_CLONE items (exclude from tar).

### GAP 4: `deactivate.js` not updated for default profile [MEDIUM]

**Issue:** Plan Phase 2 defines default pass-through behavior but doesn't update deactivate.js. User agreed: deactivate default = no-op.

**Resolution:** Add early return in deactivate.js when active === DEFAULT_PROFILE.

### GAP 5: `uninstall.js` restoreItems after rename [MEDIUM]

**Issue:** uninstall.js calls removeItems() + restoreItems(profileDir). After rename, if the profile being restored is active, its items are already in ~/.claude (not in profileDir). restoreItems would try to move from empty profileDir.

**Resolution:** If restoring active profile during uninstall: skip restore (items already in ~/.claude). If restoring non-active profile: normal restore works.

---

## Additional Concerns

### CONCERN 6: `csp save` for non-default active profile after rename

**Issue:** `save.js` calls `saveItems(profileDir)` which now MOVES items from ~/.claude to profileDir. After `csp save`, ~/.claude has no managed items! User's Claude session would see empty rules/skills/agents.

**This is a fundamental problem with the rename approach for save.js.**

**Resolution:** `csp save` must COPY, not move. Only `csp use` (switching away) should move. Need two functions:
- `saveItems(profileDir)` → COPY (for save, create, export)
- `moveItems(profileDir)` → RENAME (for use command's "save current before switch")

### CONCERN 7: source.json values after rename

**Issue:** source.json entries store absolute paths like `/home/user/.claude-profiles/work/CLAUDE.md`. After rename-restore, items are in ~/.claude, not profileDir. source.json paths point to non-existent files in profileDir. Next switch reads source.json, tries to restore from profileDir paths — files not there.

**Resolution:** restoreItems already fixed in plan (use `join(profileDir, item)` ignoring stored path). BUT saveItems must update source.json to point to profileDir paths after move. Current plan does this correctly (sourceMap[item] = dest where dest = join(profileDir, item)).

---

## Summary of Required Plan Changes

| Gap | Severity | Phase | Fix |
|---|---|---|---|
| create.js copy vs move | Medium | 1 | Split into copyItems + moveItems |
| diff.js empty profileDir | Critical | 1 | Add getEffectiveDir helper, update diff.js |
| export.js empty profileDir | Critical | 1 | Update export.js to use getEffectiveDir |
| deactivate + default | Medium | 2 | Add early return for default |
| uninstall + active profile | Medium | 2 | Skip restore if active profile |
| save.js must copy not move | **CRITICAL** | 1 | **Separate save (copy) from switch-save (move)** |
