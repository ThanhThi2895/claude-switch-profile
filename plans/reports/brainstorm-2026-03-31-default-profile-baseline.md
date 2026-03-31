# Brainstorm: Default profile drift when init does not create `default/`

**Date:** 2026-03-31
**Status:** Proposed

## Problem

`csp init` chỉ tạo metadata cho `default`, không tạo thư mục `~/.claude-profiles/default/`.

Hệ quả:
- `default` không phải snapshot thật
- `csp use <profile>` ghi đè `~/.claude`
- `csp use default` không restore baseline nào cả
- nên cái gọi là `default` bị trôi theo profile vừa dùng

## Findings

- `src/commands/init.js:17-18` chỉ `addProfile('default')` + `setActive('default')`
- `src/profile-store.js:133-136` coi `default` luôn tồn tại dù không có folder thật
- `src/commands/use.js:61-67` khi từ non-default về `default` chỉ snapshot profile hiện tại
- `src/commands/use.js:84-96` skip restore khi target là `default`
- `README.md:56-63`, `README.md:132-143` mô tả `default` là profile thật được capture lúc init
- `tests/cli-integration.test.js:241-242` lại expect `default` là virtual, không có folder

Kết luận thẳng: repo đang tự mâu thuẫn. Docs nói snapshot. Code/tests chạy theo virtual pass-through.

## Option 1 — `default` là profile thật ngay từ `init`

### Cách làm
- `csp init` tạo `~/.claude-profiles/default/`
- copy baseline hiện tại từ `~/.claude` vào đó
- `csp use default` restore như profile bình thường
- bỏ special-case "default không có folder"

### Pros
- Mental model đơn giản nhất
- Fix đúng gốc vấn đề
- Khớp với README hiện tại
- `csp create X --from default` hoạt động đúng
- Không còn chuyện `default` drift

### Cons
- Tốn disk thêm 1 snapshot baseline
- Thay đổi semantics nếu trước đây team cố tình muốn `default = live ~/.claude`
- Cần migration cho user cũ đã init theo kiểu virtual

### Đánh giá
Best nếu product nghĩa là "default = baseline chuẩn để quay về".

## Option 2 — giữ `default` là alias đặc biệt, nhưng tạo internal baseline snapshot

### Cách làm
- user vẫn thấy profile tên `default`
- nhưng hệ thống tạo internal snapshot riêng, ví dụ `.baseline/` hoặc `_system-default/`
- `csp use default` restore từ internal snapshot đó

### Pros
- Vẫn giữ được UX `default` đặc biệt
- Có baseline thật để restore
- Ít đụng đến UI/CLI naming

### Cons
- Magic nhiều hơn
- Code khó hiểu hơn Option 1
- Debug khó hơn vì có 2 khái niệm: `default` logical vs baseline physical

### Đánh giá
Làm được, nhưng complexity không đáng.

## Option 3 — chấp nhận `default` là virtual/live, sửa docs và chặn expectation snapshot

### Cách làm
- không tạo `default/`
- sửa README + help text + tests cho nhất quán
- nói rõ `default` chỉ nghĩa là "dùng trạng thái `~/.claude` hiện tại"
- có thể cảnh báo mạnh khi chạy `csp use`

### Pros
- Ít code change nhất
- Giữ nguyên implementation hiện tại

### Cons
- Không giải quyết bug theo yêu cầu business
- `default` vẫn drift theo lần switch
- `default` gần như vô nghĩa nếu mục tiêu là "quay lại baseline"
- docs/example kiểu `--from default` sẽ sai hoặc phải bỏ

### Đánh giá
Chỉ hợp nếu team chốt rằng legacy `use` không cần baseline thật. Thành thật: đây là né vấn đề, không phải fix.

## Recommended

**Chọn Option 1.**

Lý do:
- đơn giản nhất
- ít magic nhất
- đúng với expectation tự nhiên của user khi nghe "default profile"
- khớp với README đang public
- sửa luôn inconsistency `create --from default`

## Migration notes

Cho user cũ đã `init` khi chưa có `default/`:

### Safe path
- nếu phát hiện metadata có `default` nhưng thiếu folder `default/`, báo rõ cần bootstrap baseline
- tạo one-time migration command hoặc auto-migrate có confirm

### Migration rule nên dùng
- nếu `default/` thiếu và active đang là `default`: cho phép capture `~/.claude` hiện tại thành baseline mới
- nếu `default/` thiếu nhưng active là non-default: không tự đoán, vì `~/.claude` có thể đang là profile khác

Brutal honesty: auto-migrate vô điều kiện rất dễ snapshot nhầm profile đang active.

## Minimal implementation shape

- `init`: tạo folder `default/`, copy managed items/files/dirs vào đó
- `profileExists`: bỏ special-case luôn-true cho `default`
- `use`: treat `default` như profile thật ở restore path
- `current/list`: hiển thị `default` như profile vật lý bình thường, hoặc vẫn label đặc biệt nếu muốn
- tests: đổi expectation `default` must exist physically
- docs: giữ mô tả hiện tại, chỉ update phần migration

## Risks

- User cũ có thể đã quen với `default` virtual
- Migration snapshot sai baseline nếu làm auto quá tay
- Nếu `~/.claude` chứa dữ liệu local không nên clone, cần tiếp tục tôn trọng blacklist hiện có

## Final call

Nếu mục tiêu là **"switch profile xong vẫn quay về đúng default ban đầu"**, thì **bắt buộc phải có baseline thật**. Không có folder/snapshot thật thì không có gì để restore. Hết.

## Unresolved questions

- Team muốn `default` nghĩa là baseline snapshot hay live passthrough?
- Có cần migration tự động cho install cũ, hay bắt user chạy command repair rõ ràng?
- Có giữ `launch default` semantics hiện tại không, hay unify hoàn toàn với profile physical?
