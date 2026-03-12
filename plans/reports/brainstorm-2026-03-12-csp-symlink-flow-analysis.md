# CSP Symlink Flow Analysis

## Bối cảnh

Phân tích chi tiết luồng hoạt động của CSP, tập trung vào cơ chế symlink và vấn đề với real directory.

---

## 1. `csp init` — Khởi tạo

```
TRƯỚC khi init:
~/.claude/
├── skills/     ← REAL directory (42 skills)
├── rules/      ← REAL directory
├── hooks/      ← REAL directory
├── agents/     ← REAL directory
├── CLAUDE.md   ← REAL file
└── ...

SAU khi init:
~/.claude/                          (KHÔNG THAY ĐỔI GÌ)
├── skills/     ← vẫn REAL directory
├── rules/      ← vẫn REAL directory
└── ...

~/.claude-profiles/                 (MỚI TẠO)
├── .active         → "default"
├── profiles.json   → metadata
└── default/
    └── source.json → {}            ← RỖNG, không lưu gì
```

**Vấn đề**: `csp init` KHÔNG capture dữ liệu hiện tại. Profile "default" rỗng.

---

## 2. `csp create hd` — Tạo profile mới (clean)

```
~/.claude-profiles/
├── default/
│   └── source.json → {}
└── hd/                             (MỚI TẠO)
    ├── source.json → { skills: ".../hd/skills", ... }
    ├── skills/     ← thư mục RỖNG mới
    ├── rules/      ← thư mục RỖNG mới
    ├── hooks/      ← thư mục RỖNG mới
    └── agents/     ← thư mục RỖNG mới
```

---

## 3. `csp use hd` — Switch sang profile hd

```
BƯỚC 1: Lưu profile hiện tại ("default")
─────────────────────────────────────────
  readCurrentSymlinks() → check ~/.claude/skills là symlink?
  → KHÔNG, là real directory → SKIP
  → Kết quả: source.json vẫn = {}
  → Dữ liệu KHÔNG ĐƯỢC LƯU vào profile default

BƯỚC 2: Tạo backup
─────────────────────────────────────────
  ~/.claude-profiles/.backup/2026-03-12T.../
  └── source.json → {}              ← cũng rỗng

BƯỚC 3: removeSymlinks()
─────────────────────────────────────────
  Check ~/.claude/skills → isSymbolicLink()? → KHÔNG → SKIP
  Check ~/.claude/rules  → isSymbolicLink()? → KHÔNG → SKIP
  → KHÔNG XÓA GÌ (vì toàn real directory)

BƯỚC 4: createSymlinks() từ hd/source.json
─────────────────────────────────────────
  Cố tạo: ~/.claude/skills → .../hd/skills
  → nhưng ~/.claude/skills ĐANG LÀ REAL DIRECTORY
  → unlinkSync() FAIL (không xóa được directory)
  → symlinkSync() FAIL (path đã tồn tại)
  → ❌ LỖI hoặc bị nuốt im lặng

KẾT QUẢ:
~/.claude/
├── skills/     ← VẪN LÀ REAL DIRECTORY CŨ (không đổi)
├── rules/      ← VẪN LÀ REAL DIRECTORY CŨ (không đổi)
└── ...
→ Switch THẤT BẠI nhưng có thể không báo lỗi
```

---

## 4. Nếu hoạt động ĐÚNG (khi items là symlinks)

```
Giả sử ~/.claude/skills LÀ symlink → /projectA/.agents/skills

BƯỚC 3: removeSymlinks()
  ~/.claude/skills (symlink) → unlinkSync() → ✅ XÓA SYMLINK
  (Dữ liệu tại /projectA/.agents/skills VẪN CÒN NGUYÊN)

BƯỚC 4: createSymlinks() từ hd/source.json
  Tạo: ~/.claude/skills → .../hd/skills → ✅ THÀNH CÔNG

KẾT QUẢ:
~/.claude/
├── skills → ~/.claude-profiles/hd/skills    (SYMLINK MỚI)
└── ...

/projectA/.agents/skills/  ← DỮ LIỆU CŨ VẪN CÒN, không mất
```

---

## 5. Vấn đề cốt lõi

```
CSP thiết kế cho:     ~/.claude/skills → symlink
Thực tế hiện tại:     ~/.claude/skills → real directory

                    ┌─────────────────────────────┐
                    │  CSP chỉ biết xử lý SYMLINK │
                    │  Real directory → BỎ QUA     │
                    │  → Switch không hoạt động    │
                    │  → Dữ liệu không được lưu   │
                    └─────────────────────────────┘
```

**Dữ liệu KHÔNG MẤT** (CSP không xóa được real directory), nhưng CSP **KHÔNG HOẠT ĐỘNG ĐÚNG**.

---

## 6. source.json — Mục đích

`source.json` là bản ghi nhớ lưu symlink targets cho profile.

Ví dụ `~/.claude-profiles/hd/source.json`:
```json
{
  "skills": "/home/work/.claude-profiles/hd/skills",
  "rules": "/home/work/.claude-profiles/hd/rules",
  "hooks": "/home/work/.claude-profiles/hd/hooks",
  "agents": "/home/work/.claude-profiles/hd/agents"
}
```

Khi `csp use hd`: đọc source.json → tạo symlink tại `~/.claude/` trỏ tới các path này.

---

## 7. Hướng fix

### Option 1: Fix CSP — xử lý real directory
- `removeSymlinks()` cần detect real directory → move vào profile trước khi xóa
- `createSymlinks()` cần xóa real directory trước khi tạo symlink
- `csp init` cần capture real directory → move vào default profile → tạo symlink

### Option 2: Convert thủ công
- Move real directory ra ngoài → tạo symlink trỏ tới → CSP hoạt động bình thường

---

## Code References

- `src/symlink-manager.js:22-33` — `removeSymlinks()` chỉ xóa symlink, skip real directory
- `src/symlink-manager.js:36-53` — `createSymlinks()` fail khi real directory chiếm chỗ
- `src/symlink-manager.js:6-18` — `readCurrentSymlinks()` skip real directory
- `src/commands/init.js:18-22` — `initCommand()` tạo source.json rỗng, không capture
