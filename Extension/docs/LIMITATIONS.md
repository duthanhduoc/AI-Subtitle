# Giới hạn

- Document PiP được Chrome desktop hiện tại hỗ trợ, không phải mọi browser.
- DRM, frame cross-origin (vẫn thử các frame cùng origin), Shadow DOM đóng và player phụ thuộc DOM có thể ngăn việc di chuyển.
- Website có thể thay video hoặc điều hướng khi PiP đang mở; việc khôi phục là best effort.
- UTF-8 (bao gồm BOM) được hỗ trợ; encoding cũ như Windows-1258 không được chuyển đổi.
- Quảng cáo nhúng vẫn là một phần của media; extension này không chặn quảng cáo.
- Player page cần CORS phù hợp, URL media còn hiệu lực và header/cookie mà máy chủ nguồn chấp nhận. Rule `Referer` hiện chỉ dành cho `surrit.com`.
- Content script chạy trên `<all_urls>` và mọi frame để phát hiện video; Chrome vẫn chặn các trang nội bộ và nội dung cross-origin không thể truy cập.
