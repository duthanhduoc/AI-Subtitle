# Nhật ký thay đổi

## Chưa phát hành

- Đồng bộ tài liệu và comment tiếng Việt với kiến trúc hiện tại.

## 0.1.4

- Lấy HLS từ instance hls.js gắn với video đã chọn, với phát hiện request cấp tab làm phương án dự phòng.
- Mở MP4/HLS trong player page của extension và hiển thị badge độ phân giải.
- Nhận phụ đề SRT/VTT qua nút `CC+` trong player page.
- Cho content script chạy trên `<all_urls>` và mọi frame để phát hiện video.
- Đặt `Referer` cần thiết cho `surrit.com`; cookie media do trình duyệt tự gửi.

## 0.1.0

- Player Document PiP ban đầu, phát hiện video tổng quát, phân tích SRT local, popup, khung cài đặt, test và tài liệu dự án.
