# Công việc

## Hiện tại

- [ ] Chạy thử extension đã đóng gói trên các website tiêu biểu.

## Tiếp theo

- [ ] Kết nối setting `controlsDelay` với thời gian tự ẩn bộ điều khiển PiP.

## Đã hoàn thành

- [x] Lấy HLS từ video đã chọn để ẩn các stream không liên quan từ player và quảng cáo.
- [x] Đặt `Referer` cần thiết cho `surrit.com`; cookie media do trình duyệt tự gửi.
- [x] Giữ Custom PiP dùng duy nhất native VTT track của video để không vẽ trùng subtitle.
- [x] Thêm cài đặt nhanh native VTT caption trên controls của player page, gồm Default.
- [x] Rút gọn menu cài đặt PiP, chỉ giữ điều khiển tốc độ phát.
- [x] Tách markup và style của PiP player khỏi template string TypeScript.
- [x] Triển khai di chuyển Document PiP, controls, phân tích SRT, chấm điểm candidate và unit test.

## Bug đã biết

- [ ] Một số player riêng của website có thể thay thế video hoặc yêu cầu ngữ cảnh DOM gốc.
