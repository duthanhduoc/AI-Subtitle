# Kiểm thử

Chạy `bun run check`, `bun run lint`, `bun test` và `bun run build`.

Kiểm thử thủ công: mở một video HTML5 bình thường, mở và đóng PiP rồi xác nhận phát liên tục và khôi phục đúng vị trí; mở Settings trong thanh công cụ PiP và đổi tốc độ phát; thử chọn nhiều video; thay đổi kích thước PiP; thử SPA navigation và xác nhận trang không bị hỏng.

Với player page, kiểm tra MP4 trực tiếp và HLS, badge độ phân giải, nút `CC+` với cả SRT/VTT, rồi mở Custom PiP và xác nhận chỉ có một subtitle native VTT. Kiểm tra HLS cache bị xóa khi tab tải trang mới hoặc đóng. Fullscreen tuân theo hành vi của Chrome/website và không được điều phối trong v1.
