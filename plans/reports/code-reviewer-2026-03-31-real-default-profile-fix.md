## Code Review Summary

### Scope
- Files: `src/item-manager.js`, `src/file-operations.js`, `src/runtime-instance-manager.js`, `src/commands/create.js`, `src/constants.js`, `tests/cli-integration.test.js`
- Focus: recent symlink/default-profile fix
- Scout findings: checked `init/save/export/use/launch/uninstall/create` consistency, cross-device move fallback, nested symlink handling in runtime sync, and import/export safety for preserved symlinks.

### Overall Assessment
The fix moves the project in the right direction: default is now treated as a real snapshot and the happy-path integration coverage is much stronger. The biggest remaining risks are not in the tested local-path flows, but in the untested consistency gaps where symlink preservation still drops away or where imported symlinks can escape the profile boundary.

### Critical Issues
None.

### High Priority
1. `create --from` still clones without symlink-preserving semantics, so the new behavior is not consistent across create flows.
   - Evidence: `src/commands/create.js:22-24` uses `cpSync(sourceDir, profileDir, { recursive: true })` while the new snapshot code uses `verbatimSymlinks: true` elsewhere.
   - Impact: cloning from a profile that already contains managed symlinks can dereference or rewrite them, producing a profile that differs from the source profile and from `init/save/use/launch` expectations.
   - Why it matters: the user explicitly asked for consistency across `create`; this path is the remaining exception.

2. Cross-device `use`/move fallback still drops symlink preservation.
   - Evidence: `src/item-manager.js:15-18` and `src/file-operations.js:11-13` fall back to `cpSync(..., { recursive: true })` on `EXDEV`, without `verbatimSymlinks: true`.
   - Impact: when profiles/runtime live on another filesystem/device, switching profiles can silently materialize symlink targets as real directories/files instead of preserving links. This is a platform-sensitive regression that will not appear in same-device tests.
   - Affected flows: `use`, `deactivate`, and any restore/save path that relies on rename-with-EXDEV-fallback helpers.

3. Imported/exported profiles can now preserve absolute symlinks that point outside the profile tree, but there is no validation or containment check before `use`/`launch` recreates them.
   - Evidence: preserved symlinks are copied verbatim in `src/item-manager.js`, `src/file-operations.js`, `src/runtime-instance-manager.js`, and archives are imported by `src/commands/import.js` without validating symlink targets.
   - Impact: importing a profile archive from another machine or from an untrusted source can create links in `~/.claude` or `.runtime/<profile>` that resolve to arbitrary local paths outside the profile. That is both a safety issue and a portability problem.
   - Why it matters: this is the main unsafe-symlink gap introduced by switching from copy-to-content semantics to shape-preserving semantics.

### Medium Priority
1. Runtime sync can miss nested symlink changes inside managed directories.
   - Evidence: `src/runtime-instance-manager.js:43-62` only compares `isDirectory()` and `isFile()` entries in `shouldSyncDir()`. `Dirent.isSymbolicLink()` entries are ignored during equality checks.
   - Impact: if a managed directory contains a symlink child and only that symlink target changes, `shouldSyncDir()` can incorrectly decide the runtime tree is already up to date and skip copying, leaving stale runtime config.
   - Affected flows: mainly `launch`, especially for hook/skill trees containing symlinked children.

### Edge Cases Found by Scout
- Cross-filesystem profile switching (`EXDEV`) is still inconsistent with the new symlink-preserving snapshot logic.
- `create --from` remains on the old copy semantics.
- Importing archives with absolute symlinks can recreate external references in active/runtime config.
- Nested symlinks inside managed directories are not fully accounted for by runtime change detection.

### Positive Observations
- `ensureDefaultProfileSnapshot()` now fails closed when a legacy install is missing the default snapshot and a non-default profile is active; that avoids reconstructing `default` from the wrong live state.
- The new integration tests cover the core default-profile lifecycle much better: `init`, `use default`, `save`, `deactivate`, `launch`, `export`, and `uninstall`.
- `launch default` correctly distinguishes active-default live state vs inactive-default stored snapshot.

### Recommended Actions
1. Make `create --from` use the same symlink-preserving copy helper as the other snapshot flows.
2. Add `verbatimSymlinks: true` to every `EXDEV` fallback copy path used by move operations.
3. Decide and enforce a symlink safety policy for import/use/launch (for example: block absolute symlinks, block escapes outside the profile root, or warn and require `--force`).
4. Extend runtime sync/change-detection tests to cover nested symlink entries inside managed directories.

### Metrics
- LOC: `git diff --numstat` pending
- Type Coverage: N/A (JavaScript project)
- Test Coverage: not measured in this review
- Linting Issues: not run in this review
- Validation: `node --test /home/work/Desktop/my-project/claude-switch-profile/tests/cli-integration.test.js` passed (48/48)

### Unresolved Questions
- Should CSP allow any absolute symlink in exported/imported profiles, or should profile contents be self-contained by design?
- Are profiles/runtimes expected to work when `~/.claude` and the profiles directory are on different filesystems/devices?
- Do managed directories intentionally support nested symlinks, or should those be normalized/blocked?
