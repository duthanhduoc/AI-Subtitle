# Phát triển

Chạy `bun install`, sau đó `bun run dev` để phát triển UI hoặc `bun run build` để tạo `dist/` có thể load. Dùng Chrome DevTools riêng cho popup, content script, service worker, player page và cửa sổ PiP. Khi thêm message, cập nhật `src/shared/messages.ts`, kiểm tra dữ liệu trong handler rồi cập nhật các UI gọi nó. Setting thuộc về options UI và `chrome.storage.local`; parser nên tạo `SubtitleTrack` mà không thay đổi player. Khi thay quyền, content script hoặc rule DNR, phải cập nhật `PRIVACY.md`, `SECURITY.md` và tài liệu kiến trúc.
