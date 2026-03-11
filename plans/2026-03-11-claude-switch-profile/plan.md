---
title: "Claude Switch Profile (csp)"
description: "Node.js CLI tool for managing multiple Claude Code profiles"
status: pending
priority: P1
effort: "6h"
branch: "main"
tags: [cli, profiles, claude-code]
created: 2026-03-11
---

# Claude Switch Profile (csp)

## Overview

CLI tool to switch between multiple Claude Code configuration profiles. Uses hybrid approach: symlink dirs (skills, hooks, agents, rules) + copy mutable files (settings.json, .env, .ck.json). Profiles stored at `~/.claude-profiles/`.

## Phase 1: Project Setup & Constants — Initialize npm project, define constants and config schema

-> [phase-01-project-setup.md](phase-01-project-setup.md)

- [ ] Done

## Phase 2: Core Library — Profile store, symlink manager, file operations, validation

-> [phase-02-core-library.md](phase-02-core-library.md)

- [ ] Done
Depends on: Phase 1

## Phase 3: CLI Commands — Implement all 9 commands with Commander.js

-> [phase-03-cli-commands.md](phase-03-cli-commands.md)

- [ ] Done
Depends on: Phase 2

## Phase 4: Safety & Polish — Backup, lock file, process detection, dry-run, init flow

-> [phase-04-safety-and-polish.md](phase-04-safety-and-polish.md)

- [ ] Done
Depends on: Phase 3

## Phase 5: Testing — Unit and integration tests

-> [phase-05-testing.md](phase-05-testing.md)

- [ ] Done
Depends on: Phase 4

## Files Affected

### Create
- `package.json`
- `bin/csp.js`
- `src/constants.js`
- `src/profile-store.js`
- `src/symlink-manager.js`
- `src/file-operations.js`
- `src/profile-validator.js`
- `src/safety.js`
- `src/commands/list.js`
- `src/commands/use.js`
- `src/commands/create.js`
- `src/commands/current.js`
- `src/commands/save.js`
- `src/commands/delete.js`
- `src/commands/export.js`
- `src/commands/import.js`
- `src/commands/diff.js`
- `tests/*.test.js`

### Update
- *(none)*

### Delete
- *(none)*
