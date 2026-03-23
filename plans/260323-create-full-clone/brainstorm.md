# Brainstorm: `csp create` Full Clone Logic

## Problem

`csp create <name>` (default case, no `--from`/`--source`) tạo profile mới nhưng **không clone đầy đủ** `~/.claude/`. Nhiều item cần thiết cho Claude hoạt động bị bỏ sót.

## Actual `~/.claude/` Inventory

Scan thực tế `~/.claude/` trên máy user:

### Directories (26)

| Item | Size | Category hiện tại | Cần clone? |
|------|------|--------------------|------------|
| `agents/` | 90KB | SYMLINK_ITEMS ✅ | ✅ Yes |
| `skills/` | 306MB | SYMLINK_ITEMS ✅ | ✅ Yes |
| `rules/` | 16KB | SYMLINK_ITEMS ✅ | ✅ Yes |
| `hooks/` | 869KB | SYMLINK_ITEMS ✅ | ✅ Yes |
| `commands/` | 4KB | COPY_DIRS ✅ | ✅ Yes |
| `plugins/` | 6.3MB | COPY_DIRS ✅ | ✅ Yes |
| `workflows/` | 10KB | ❌ MISSING | ✅ **Yes — cần thêm** |
| `scripts/` | 53KB | ❌ MISSING | ✅ **Yes — cần thêm** |
| `output-styles/` | 27KB | ❌ MISSING | ✅ **Yes — cần thêm** |
| `schemas/` | 11KB | ❌ MISSING | ⚠️ Tùy — Claude internal? |
| `downloads/` | 0KB | ❌ MISSING | ❌ No — transient |
| `sessions/` | 0.1KB | ❌ MISSING | ❌ No — runtime |
| `cache/` | 162KB | NEVER_TOUCH ✅ | ❌ No |
| `telemetry/` | 1MB | NEVER_TOUCH ✅ | ❌ No |
| `debug/` | 52KB | NEVER_TOUCH ✅ | ❌ No |
| `projects/` | 4.7MB | NEVER_TOUCH ✅ | ❌ No |
| `backups/` | 77KB | NEVER_TOUCH ✅ | ❌ No |
| `session-env/` | 27KB | NEVER_TOUCH ✅ | ❌ No |
| `shell-snapshots/` | 6KB | NEVER_TOUCH ✅ | ❌ No |
| `paste-cache/` | 0KB | NEVER_TOUCH ✅ | ❌ No |
| `ide/` | 0.6KB | NEVER_TOUCH ✅ (implicit) | ❌ No |
| `todos/` | 7KB | NEVER_TOUCH ✅ | ❌ No |
| `tasks/` | 0KB | NEVER_TOUCH ✅ | ❌ No |
| `statsig/` | 67KB | ❌ MISSING | ❌ No — analytics |
| `command-archive/` | 60KB | ❌ MISSING | ❌ No — archive |
| `commands-archived/` | 93KB | ❌ MISSING | ❌ No — archive |

### Files (14)

| Item | Size | Category hiện tại | Cần clone? |
|------|------|--------------------|------------|
| `CLAUDE.md` | 2KB | SYMLINK_ITEMS ✅ | ✅ Yes |
| `statusline.cjs` | 18KB | SYMLINK_ITEMS ✅ | ✅ Yes |
| `settings.json` | 3.5KB | COPY_ITEMS ✅ | ✅ Yes (cập nhật paths) |
| `.env` | 0.3KB | COPY_ITEMS ✅ | ✅ Yes |
| `.ck.json` | 1.8KB | COPY_ITEMS ✅ | ✅ Yes |
| `.ckignore` | 0.2KB | COPY_ITEMS ✅ | ✅ Yes |
| `.mcp.json` | 0.6KB | ❌ MISSING | ✅ **Yes — MCP server config** |
| `.mcp.json.example` | 0.5KB | ❌ MISSING | ⚠️ Optional |
| `.env.example` | 3.6KB | ❌ MISSING | ⚠️ Optional |
| `.gitignore` | 0.6KB | ❌ MISSING | ⚠️ Optional |
| `statusline.sh` | 8KB | ❌ MISSING | ✅ **Yes — statusline Unix** |
| `statusline.ps1` | 8KB | ❌ MISSING | ✅ **Yes — statusline Windows** |
| `history.jsonl` | 38KB | NEVER_TOUCH ✅ | ❌ No |
| `metadata.json` | 410KB | NEVER_TOUCH (implicit) | ❌ No |
| `stats-cache.json` | 2.6KB | ❌ MISSING | ❌ No — cache |
| `active-plan` | 0KB | ❌ MISSING | ❌ No — runtime |

---

## Current Bugs in `create.js` (Default Case)

1. **`saveFiles()` không được gọi** → mất settings.json, .env, .ck.json, .ckignore
2. **`source.json` trỏ vào chính profileDir** → profile "độc lập" nhưng khi switch, symlink trỏ ngược lại profile dir thay vì original source
3. **Nhiều item quan trọng không nằm trong managed lists** → `.mcp.json`, `workflows/`, `scripts/`, `output-styles/`, `statusline.sh`, `statusline.ps1`

---

## Proposed Approach: Negation-Based Cloning

Thay vì liệt kê những gì cần clone (whitelist), dùng **blacklist** — clone TẤT CẢ trừ items trong `NEVER_TOUCH`.

### Approach A: Đơn giản — Mở rộng constants lists

Thêm các items thiếu vào `SYMLINK_ITEMS`, `COPY_ITEMS`, `COPY_DIRS`.

**Pros:** Ít thay đổi code, dễ hiểu
**Cons:** Mỗi khi Claude thêm folder mới → phải update constants. Dễ miss.

### Approach B: Blacklist (Recommended) ✅

Scan `~/.claude/`, copy tất cả trừ `NEVER_CLONE` items.

**Pros:** Future-proof, bắt được mọi item mới Claude thêm
**Cons:** Cần refactor logic, phân biệt symlink vs copy rõ hơn

### Approach C: Hybrid

Giữ `SYMLINK_ITEMS` cho symlink management, nhưng `create` (clone) dùng blacklist.

**Pros:** Best of both — symlink management explicit, clone comprehensive
**Cons:** Hai hệ thống concepts có thể confusing

---

## Recommended: Approach C (Hybrid)

### Rationale

- `SYMLINK_ITEMS` vẫn cần thiết cho `use/save/restore` — biết items nào phải xử lý symlink
- `create` (clone) nên dùng blacklist để không miss bất kỳ thứ gì
- Khi clone: **copy thực** (dereference), không tạo symlinks trỏ ngược

### Proposed Constants Changes

```javascript
// Items to EXCLUDE from cloning (runtime/session data)
export const NEVER_CLONE = [
  // Runtime/session
  '.credentials.json',
  'projects',
  'sessions',
  'session-env',
  'ide',
  // Cache/temp
  'cache',
  'paste-cache',
  'downloads',
  'stats-cache.json',
  'active-plan',
  // Logs/tracking
  'history.jsonl',
  'metadata.json',
  'telemetry',
  'debug',
  'statsig',
  // Backups/archives
  'backups',
  'command-archive',
  'commands-archived',
  // Task tracking (per-session)
  'todos',
  'tasks',
  'teams',
  'agent-memory',
  'plans',
  'file-history',
  'shell-snapshots',
];
```

### Proposed `create.js` Logic (Default Case)

```
1. mkdirSync(profileDir)
2. Scan ~/.claude/ entries
3. For each entry:
   - Skip if in NEVER_CLONE
   - If entry is symlink → record target in source.json (preserve original symlink target)
   - If entry is real dir/file → cpSync to profileDir, record in source.json pointing to profileDir copy
4. saveFiles(profileDir) ← copy mutable files
5. Update settings.json paths to reflect new profile dir
```

### Key Fix: Preserve Original Symlink Targets

Hiện tại `create` default case dùng `dereference: true` → copy content nhưng mất thông tin symlink target. Thay vào đó:

- **Nếu item là symlink** → ghi `readlinkSync()` target vào `source.json` (giữ nguyên pointer gốc)
- **Nếu item là real dir/file** → copy vào profileDir, ghi profileDir path vào `source.json`

→ Như vậy profile mới sẽ giữ cùng symlink targets như profile gốc.

### `settings.json` Path Update

`settings.json` chứa paths tuyệt đối (vd: hooks paths). Khi clone cần:
1. Copy nguyên `settings.json`
2. Nếu có hooks config trỏ đến `~/.claude/hooks/...` → update path thành profile's hooks path

---

## Impact Assessment

| Component | Impact |
|-----------|--------|
| `constants.js` | Add `NEVER_CLONE` list |
| `create.js` | Refactor default case to scan + blacklist |
| `file-operations.js` | No change (still handles COPY_ITEMS/COPY_DIRS for use/save) |
| `symlink-manager.js` | No change |
| `use.js` | May need minor update if new items added to managed lists |
| Tests | Need update for new clone behavior |

## Unresolved Questions

1. **`schemas/` folder** — Claude internal? Có cần clone không?
2. **`.mcp.json`** — Nên là COPY_ITEMS (mutable per-profile) hay SYMLINK_ITEMS?
3. **`settings.json` hooks paths** — Cần tự động update paths không, hay giữ nguyên and let symlinks handle it?
4. **`--from` clone case** — Có cần update theo logic mới không? (hiện tại chỉ `cpSync` recursive — có vẻ OK)

---

*Generated: 2026-03-23*
