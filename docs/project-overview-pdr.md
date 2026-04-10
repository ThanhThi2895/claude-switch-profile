# Claude Switch Profile - Project Overview & PDR

## Executive Summary

**Claude Switch Profile (CSP)** is a Node.js CLI tool that enables developers to manage multiple isolated Claude Code configurations on a single machine. Each profile maintains separate managed items (rules/agents/skills), copied settings/environment variables, and custom commands—allowing effortless switching between different development setups without conflicts.

**Problem Solved:** Developers frequently need multiple Claude Code configurations (work vs. personal, experimental vs. production, client A vs. client B). Manual switching is error-prone and time-consuming. CSP automates this with profile management, version control, export/import, and safety features.

## Product Vision

Enable developers to:
1. Capture and restore complete Claude Code environments
2. Switch between profiles without manual file management
3. Share profiles with teammates via exports
4. Safely experiment with new tools and configurations
5. Maintain configuration history and backups

## Functional Requirements

### Core Features

#### 1. Profile Management
- **Init**: Initialize the system and capture current managed `~/.claude` state as a physical `default` profile snapshot
- **Create**: Create new profiles from current state or clone existing profiles
- **List**: Show all profiles with descriptions and creation dates
- **Current**: Display the active legacy profile name and location
- **Use**: Switch to a different profile with auto-save and validation; accepts `use [name]` and defaults to `default`
- **Save**: Manually save the active profile snapshot
- **Delete**: Remove a profile (with confirmation)
- **Deactivate**: Switch an active non-default legacy profile back to the physical `default` snapshot
- **Launch**: Launch isolated Claude Code session per profile while preserving profile metadata semantics
- **Uninstall**: Remove only the CSP CLI installation while keeping all profiles; does not wipe profile data or rewrite `~/.claude`
- **Select**: Interactive arrow-key profile picker (default command when no subcommand given)
- **Status**: Show CSP status dashboard (active profile, profile count, last launch, Claude state)
- **Toggle**: Switch to the previous profile and launch it
- **Exec**: Run arbitrary commands inside an isolated profile runtime without mutating global `~/.claude`
- **Update**: Update the installed CSP CLI using auto-detected or explicit install method

#### 2. Profile Sharing
- **Export**: Package profile as tar.gz archive
- **Import**: Restore profile from archive with optional rename

#### 3. Comparison & Debugging
- **Diff**: Compare two profiles to identify configuration differences

### Managed Items

#### Managed Static Items (managed in profiles)
- `CLAUDE.md` — Project configuration
- `rules/` — Development guidelines
- `agents/` — Agent scripts
- `skills/` — Luna skills
- `hooks/` — Event hooks
- `statusline.cjs` — Custom statusline (Node.js)
- `statusline.sh` — Custom statusline (bash)
- `statusline.ps1` — Custom statusline (PowerShell)
- `.luna.json` — Luna config

**Rationale:** These items are managed in profiles for isolation and portability.

#### Copied Files (environment-specific)
- `settings.json` — Editor settings
- `.env` — Environment variables
- `.ck.json` — Custom settings
- `.ckignore` — Ignore patterns
- `.mcp.json` — MCP configuration
- `.mcp.json.example` — MCP template
- `.env.example` — Environment template
- `.gitignore` — Git ignore rules

#### Copied Directories
- `commands/` — Custom commands
- `plugins/` — Custom plugins
- `workflows/` — Workflow files
- `scripts/` — Script utilities
- `output-styles/` — Output styling
- `schemas/` — JSON schemas

#### Protected Items (never cloned/touched)
- Runtime data: `.credentials.json`, `projects/`, `sessions/`, `session-env/`, `ide/`, `cache/`, `paste-cache/`, `downloads/`
- Tracking data: `history.jsonl`, `metadata.json`, `stats-cache.json`, `active-plan`
- Session data: `agent-memory/`, `todos/`, `tasks/`, `teams/`, `plans/`, `file-history/`, `shell-snapshots/`
- Telemetry: `telemetry/`, `debug/`, `statsig/`, `backups/`, `command-archive/`, `commands-archived/`
- Requirement: these protected/session paths stay excluded from init, save, export, launch runtime sync, migration backfill, and uninstall restore flows

### Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Performance** | Profile switching < 2 seconds (excluding Claude restart) |
| **Data Safety** | Auto-backups on every switch; lock file prevents concurrent ops |
| **Portability** | Linux/macOS/Unix; Windows 10+ (native junctions, no admin required) |
| **Reliability** | Validates profile structure; detects stale locks; restores from backup on error |
| **Testability** | Env var overrides (CSP_CLAUDE_DIR, CSP_PROFILES_DIR) for isolated testing |
| **Usability** | Intuitive CLI with clear error messages; --dry-run for preview |
| **Compatibility** | Node.js >= 18.0.0; ES modules; minimal dependencies (chalk, commander) |

## Architecture

### Directory Structure

**Profile Storage:**
```
~/.claude-profiles/
├── .active              # File: current legacy-active profile name
├── profiles.json        # File: metadata for all profiles
├── .lock                # File: PID lock during operations
├── .backup/             # Dir: timestamped backups
├── .runtime/            # Dir: isolated launch runtime roots
├── default/             # Physical default snapshot created by init
└── {profile-name}/
    ├── source.json      # Managed item source map
    ├── settings.json    # Copied from ~/.claude
    ├── .env             # Copied from ~/.claude
    ├── .ck.json         # Copied from ~/.claude
    ├── .ckignore        # Copied from ~/.claude
    ├── commands/        # Copied dir from ~/.claude
    └── plugins/         # Copied dir from ~/.claude
```

### Core Modules

| Module | Responsibility |
|---|---|
| `bin/csp.js` | CLI entry point; command routing (18 commands) |
| `src/commands/*.js` | Individual command implementations |
| `profile-store.js` | Profile metadata read/write (profiles.json, .active) |
| `runtime-instance-manager.js` | Runtime isolation and syncing for launch |
| `item-manager.js` | Managed item copy/restore operations |
| `launch-effective-env-resolver.js` | Environment variable resolution for launch |
| `file-operations.js` | File and directory copy/restore |
| `safety.js` | Locking, backups, process detection, validation |
| `profile-validator.js` | Profile structure validation |
| `output-helpers.js` | Console output (colors, symbols) |
| `constants.js` | Configuration paths and managed items lists |
| `platform.js` | Cross-platform compatibility (Windows junctions, process detection) |

### Profile Switching Flow

```
User runs: csp use [profile]
    ↓
CLI validates profile exists & structure valid
    ↓
If target or active is default, ensure physical default snapshot exists
    ↓
Legacy install missing default snapshot?
  - Active = default or unset → guarded backfill from current managed ~/.claude
  - Active = non-default      → fail closed with repair guidance
    ↓
(If --dry-run) Show changes and exit
    ↓
Detect if Claude running and block switch
(Windows: uses tasklist; Unix: uses pgrep)
    ↓
Acquire lock file (prevent concurrent ops)
    ↓
Save active profile snapshot:
  - Write managed item map to source.json
  - Copy mutable files/directories from ~/.claude
    ↓
Remove all managed items from ~/.claude
    ↓
Restore target profile snapshot by copy:
  - Read source.json
  - Restore managed items in ~/.claude
  - Copy files/directories from profile to ~/.claude
    ↓
Update .active marker
    ↓
Release lock file
    ↓
Print success message
    ↓
Remind user to restart Claude Code
```

### Data Model

**Profile Metadata (profiles.json):**
```json
{
  "version": 2,
  "profiles": {
    "default": {
      "created": "2026-03-31T10:00:00.000Z",
      "description": "Vanilla Claude defaults",
      "mode": "legacy",
      "runtimeDir": "/home/user/.claude-profiles/.runtime/default",
      "runtimeInitializedAt": null,
      "lastLaunchAt": null
    },
    "production": {
      "created": "2026-03-31T10:15:00.000Z",
      "description": "Production environment with logging",
      "mode": "account-session",
      "runtimeDir": "/home/user/.claude-profiles/.runtime/production",
      "runtimeInitializedAt": null,
      "lastLaunchAt": null
    }
  }
}
```

**Symlink Targets (source.json):**
```json
{
  "CLAUDE.md": "/path/to/project/CLAUDE.md",
  "rules": "/path/to/rules-repo/rules",
  "agents": "/home/user/.agents",
  "skills": "/home/user/.luna-skills",
  "hooks": "/home/user/.claude/hooks",
  "statusline.cjs": "/home/user/.claude/statusline.cjs",
  "statusline.sh": "/home/user/.claude/statusline.sh",
  "statusline.ps1": "/home/user/.claude/statusline.ps1",
  ".luna.json": "/home/user/.luna.json"
}
```

## Technical Stack

| Component | Technology | Rationale |
|---|---|---|
| Runtime | Node.js ES modules | Modern, fast, minimal runtime |
| CLI Framework | commander.js | Battle-tested, flexible option parsing |
| Output | chalk | Color and formatting support |
| Compression | tar (native) | Portable, no additional dependencies |
| Testing | Node.js built-in assert + test | No external test runner needed |

## Implementation Phases

### Phase 1: Project Setup
- Create Node.js project structure
- Configure package.json with entry point
- Set up bin/csp.js CLI entry
- Implement constants and basic modules

### Phase 2: Core Library
- Implement profile-store.js (metadata management)
- Implement item-manager.js (managed item save/restore operations)
- Implement file-operations.js (copy/restore)
- Implement profile-validator.js (validation logic)

### Phase 3: CLI Commands
- Implement all 18 commands (select, init, current, list, status, create, save, use, toggle, delete, export, import, diff, deactivate, launch, exec, uninstall, update)
- Wire commands into CLI framework
- Implement error handling and messaging

### Phase 4: Safety & Polish
- Implement lock file mechanism
- Implement auto-backup functionality
- Implement Claude process detection
- Add dry-run mode
- Add validation before switching

### Phase 5: Testing
- Write unit tests for core modules
- Write integration tests for CLI
- Write safety feature tests

## Success Criteria

### Functional
- [x] All 18 commands implemented and working
- [x] Profiles correctly capture/restore state
- [x] Managed items properly handled (copy/restore)
- [x] Files copied/restored correctly
- [x] Metadata persisted accurately
- [x] Export/import works end-to-end
- [x] Diff shows accurate differences

### Non-Functional
- [x] Lock file prevents concurrent operations
- [x] Auto-backups created on every switch
- [x] Stale locks detected and cleaned
- [x] Profile validation passes before switching
- [x] Symlink target validation optional (--force override)
- [x] Claude process detection warns user
- [x] Dry-run mode previews changes

### Code Quality
- [x] Clear, modular code structure
- [x] Comprehensive error handling
- [x] Helpful error messages
- [x] Tests passing (core, CLI, safety)

## Security Considerations

### Data Protection
- **Profile Storage:** Stored in user home directory (`~/.claude-profiles/`)
- **Sensitive Files:** `.env` may be copied into profile snapshots; `.credentials.json` and other protected/session files are never managed or exported
- **Backups:** Timestamped backups are pruned to the 2 most recent snapshots
- **Migration Safety:** Legacy `default` backfill only runs when the live `~/.claude` state is safe to treat as the intended default baseline

### Access Control
- Single-user model (per machine user)
- No authentication required (filesystem-based)
- Managed-item symlinks are preserved in saved snapshots and isolated runtime sync, so external repos keep controlling access through the original link targets

### Operational Safety
- **Lock File:** Prevents corruption from concurrent operations
- **Backups:** Auto-created before every destructive operation
- **Validation:** Checks profile structure before applying
- **Warnings:** Alerts user about Claude running process
- **Confirmation:** Delete requires explicit confirmation (unless --force)

## Dependencies & Constraints

### Hard Dependencies
- Node.js >= 18.0.0
- POSIX or Windows 10+ (symlinks/junctions, tar, pgrep/tasklist)
- Writable home directory

### External Dependencies (npm)
- `chalk@^5.6.2` — Console colors
- `commander@^14.0.3` — CLI argument parsing

### Constraints
- Windows uses NTFS junctions and `tasklist` for process detection
- Profile switching requires Claude Code restart
- Cannot manage `.credentials.json` (left untouched for security)
- Managed items must exist in source profile when restoring (unless handled gracefully)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Accidental profile deletion | Medium | High | Confirmation prompt + auto-backups |
| Concurrent profile switches | Low | High | Lock file with PID validation |
| Missing managed item sources | Medium | Medium | Graceful skip + warning message |
| Corrupted metadata | Low | High | JSON validation + backups |
| User forgets to restart Claude | High | Medium | Warning message on switch |
| Legacy install missing `default/` while non-default is active | Medium | High | Fail closed; require user to switch back to intended default baseline before backfill |

## Future Enhancements

1. **Profile Merging** — Merge changes from one profile into another
2. **Web UI** — Browser-based profile manager
3. **Cloud Sync** — Sync profiles across machines
4. **Version Control** — Git integration for profile history
5. **Snapshots** — Time-travel through profile history
6. **Templates** — Pre-configured profile templates
7. **Hooks** — Custom scripts on profile switch


## Development Roadmap

| Phase | Status | Completion |
|---|---|---|
| Phase 1: Setup | Complete | 100% |
| Phase 2: Core Library | Complete | 100% |
| Phase 3: CLI Commands | Complete | 100% |
| Phase 4: Safety & Polish | Complete | 100% |
| Phase 5: Testing | Complete | 100% |

## Success Metrics

- **Adoption:** Primary use case is switching between work/personal profiles
- **Reliability:** Zero data loss due to concurrent operations (lock file working)
- **User Satisfaction:** Clear error messages, intuitive workflow
- **Code Quality:** Test coverage > 80%, passing all tests, clean architecture

## Definitions & Glossary

| Term | Definition |
|---|---|
| **Profile** | A snapshot of Claude Code configuration at `~/.claude` (managed items + files) |
| **Active Profile** | The currently loaded profile, determined by `.active` marker |
| **Managed Items** | Configuration items controlled by CSP (rules, agents, skills, hooks, etc.) |
| **Copy Items** | Mutable files copied into profile (settings.json, .env) |
| **Backup** | Timestamped copy of managed items before switching |
| **Lock File** | PID-based marker preventing concurrent profile operations |
| **Dry Run** | Preview mode showing changes without executing them |
| **Source Map** | JSON object mapping managed item names to target paths |

## Contact & Support

- **Repository:** https://github.com/user/claude-switch-profile
- **Issues:** GitHub Issues
- **License:** MIT

---

**Last Updated:** 2026-04-10
**Version:** 1.4.0
**Status:** Complete
