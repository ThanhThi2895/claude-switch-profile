---
title: "Default Profile, Multi-Launch, Performance Optimization"
description: "Make default profile pass-through, enable multi-launch, optimize switch from 27s to <500ms via rename"
status: completed
priority: P1
effort: 4h
branch: feat/csp-fixes-260323
tags: [performance, ux, refactor]
created: 2026-03-25
---

# Default Profile, Multi-Launch, Performance Optimization

## Overview

3 issues: (1) default profile should be live ~/.claude pass-through, (2) launch blocks multi-instance, (3) switch takes 10-27s due to 365MB copy.

Core insight: replace `cpSync` with `renameSync` for O(1) switch. Default profile skips save/restore entirely.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Move/rename item-manager | Done | 2h | [phase-01](./phase-01-move-rename.md) |
| 2 | Default pass-through | Done | 1h | [phase-02](./phase-02-default-passthrough.md) |
| 3 | Simplify launch | Done | 30m | [phase-03](./phase-03-simplify-launch.md) |
| 4 | Tests & validation | Done | 30m | [phase-04](./phase-04-tests.md) |

## Validation

See [validation-report.md](./validation-report.md) — 6 gaps found and addressed in revised phases.

Key corrections:
- Split copyItems (non-destructive) vs moveItems (destructive) — save.js MUST copy, only use.js moves
- Add getEffectiveDir() — diff.js and export.js need to read from ~/.claude when profile is active
- Default profile handling for deactivate, delete, uninstall, export, diff

## Dependencies

- All changes in `src/` — no external deps
- Phase 1 is prerequisite for phases 2-3
- Phase 4 runs after all others
