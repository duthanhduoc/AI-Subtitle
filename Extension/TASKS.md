# Công việc

## Hiện tại

- [ ] Chạy thử extension đã đóng gói trên các website tiêu biểu.

## Tiếp theo

- [ ] Kết nối setting `controlsDelay` với thời gian tự ẩn bộ điều khiển PiP.

## Việc tồn đọng

- [ ] Thêm hỗ trợ WebVTT cho Document PiP được mở từ video trên trang nguồn.

## Đã hoàn thành

- [x] Lấy HLS từ video đã chọn để ẩn các stream không liên quan từ player và quảng cáo.
- [x] Đặt `Referer` cần thiết cho `surrit.com`; cookie media do trình duyệt tự gửi.
- [x] Chuẩn hóa kích thước và độ đậm phụ đề responsive giữa các preset.
- [x] Thiết kế lại menu cài đặt PiP với các dòng gọn kiểu YouTube và submenu track/tốc độ tùy chỉnh.
- [x] Thêm cài đặt player có thể đóng, độ đậm phụ đề responsive và track tắt phụ đề.
- [x] Tách markup và style của PiP player khỏi template string TypeScript.
- [x] Triển khai di chuyển Document PiP, controls, phân tích SRT, chấm điểm candidate và unit test.
- [x] Giữ track SRT và lựa chọn đang active cho session trang hiện tại, đồng thời lưu preset phụ đề ở phạm vi toàn extension.
- [x] Áp dụng font, nền và preset phụ đề đã lưu cho trình render PiP.

## Bug đã biết

- [ ] Một số player riêng của website có thể thay thế video hoặc yêu cầu ngữ cảnh DOM gốc.
