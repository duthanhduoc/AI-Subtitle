# Custom Document PiP

Extension Chrome Manifest V3 di chuyển video HTML5 được chọn vào cửa sổ Document Picture-in-Picture tùy chỉnh, đồng thời có player riêng cho MP4/HLS và phụ đề local.

## Tính năng

- Chấm điểm các video đang hiển thị (bao gồm Shadow DOM mở) và cho phép chọn khi cần.
- Tái sử dụng phần tử video hiện có, tránh mở luồng thứ hai khi website cho phép.
- Điều khiển PiP tùy chỉnh, không làm tối; tua, âm lượng, tốc độ phát và phím tắt.
- Phát hiện playlist HLS `.m3u8` theo tab và mở MP4/HLS trong player page của extension.
- Hiển thị độ phân giải video; player page nhận phụ đề SRT/VTT, còn Document PiP nhận SRT.
- Phân tích phụ đề local và hiển thị nội dung không đáng tin cậy bằng API DOM an toàn.
- Không có backend, tài khoản, analytics, telemetry hoặc upload phụ đề. Request media chỉ được gửi tới máy chủ nguồn để phát video.

## Cài đặt và chạy

```sh
bun install
bun run build
```

Mở `chrome://extensions`, bật Developer mode, chọn **Load unpacked** và chọn `dist/`.

Dùng nút extension trên tab có video HTML5, chọn video nếu cần rồi mở Picture-in-Picture. Sau khi PiP mở, dùng Settings để thêm file `.srt`. Offset phụ đề dương nghĩa là cue được chọn tại `video.currentTime + offset`, vì vậy phụ đề sẽ xuất hiện sớm hơn.

Với MP4 có URL trực tiếp, dùng nút **Play**. Với HLS, dùng **Play** trong phần **Detected HLS streams**. Cả hai mở player page của extension; nút **CC+** trong thanh điều khiển nhận file `.srt` hoặc `.vtt`.

Phím tắt trong PiP: Space play/pause; Left/Right ±5s; J/L ±10s; M tắt tiếng; Up/Down âm lượng; `[`/`]` offset phụ đề.

## Phát triển

`bun run dev`, `bun run check`, `bun run lint`, `bun test` và `bun run build` là các kiểm tra của dự án. Xem [AGENTS.md](AGENTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) và [docs/TESTING.md](docs/TESTING.md).

## Giới hạn

Document PiP yêu cầu Chrome desktop hiện đại. DRM, frame cross-origin, Shadow DOM đóng và player gắn chặt với DOM gốc có thể hoạt động không thành công nhưng vẫn được xử lý an toàn. Không thực hiện DRM bypass, chặn quảng cáo, lưu trữ cloud hoặc chuyển đổi encoding phụ đề cũ.
