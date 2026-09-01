# Quyền riêng tư

Chính sách này áp dụng cho phiên bản 0.1.4. Extension không có tài khoản, backend, analytics hoặc telemetry. Content script chạy trên các trang khớp `<all_urls>` và service worker quan sát request `.m3u8` để phát hiện HLS. Tối đa 10 URL HLS gần nhất của mỗi tab được giữ tạm trong `chrome.storage.session`; dữ liệu của tab bị xóa khi tab tải trang mới hoặc đóng và không được gửi tới máy chủ của extension.

File phụ đề được đọc local, chỉ giữ trong bộ nhớ của session trang/player và không bao giờ upload hoặc ghi vào extension storage. Khi phát MP4/HLS, trình duyệt vẫn gửi request trực tiếp tới máy chủ media gốc; popup cũng có thể tải manifest HLS để đọc thông tin stream. Rule dành cho `surrit.com` chỉ đặt header `Referer` cần thiết để máy chủ cho phép phát media.
