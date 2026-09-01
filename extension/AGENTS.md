# Hướng dẫn cho agent lập trình AI

## Mục đích

Custom Document PiP là extension Chrome MV3 xử lý dữ liệu tại trình duyệt, dành cho video HTML5, luồng HLS và phụ đề local.

## Kiến trúc

- `src/popup`: popup Svelte 5; phát hiện media và chỉ gửi các message có thể tuần tự hóa.
- `src/content`: phát hiện video và điều phối PiP không dùng framework.
- `src/pip`: giao diện DOM của Document PiP và vòng đời di chuyển phần tử.
- `src/player-page`: player riêng của extension cho MP4/HLS, phụ đề SRT/VTT và badge độ phân giải.
- `src/subtitles`: kiểu cue đã chuẩn hóa, bộ phân tích SRT và tìm kiếm nhị phân.
- `src/background`: service worker MV3 phát hiện URL HLS theo tab, giữ cache trong phiên và hỗ trợ nạp content script.

## Bất biến

Không tạo video thay thế từ `src`; hãy di chuyển phần tử thật và khôi phục nó theo cách idempotent. Nội dung file phụ đề là dữ liệu không đáng tin cậy; không bao giờ dùng `innerHTML`. Phần lõi PiP phải tiếp tục là code TypeScript/DOM, không phải Svelte. Không gửi dữ liệu tới backend của extension và không thêm DRM bypass, chặn quảng cáo, theo dõi hoặc code từ xa.

## Quy trình

Dùng Bun: `bun install`, sau đó chạy `bun run check`, `bun run lint`, `bun test` và `bun run build`. Kết quả build nằm trong `dist/`. Cập nhật tài liệu liên quan và `TASKS.md` khi có thay đổi đáng kể. Kiểm tra message tại các ranh giới runtime và dùng TypeScript strict, không dùng `any`.

## Comment trong code

Khi tạo hoặc thay đổi code, thêm comment ngắn gọn bằng tiếng Việt cho quy tắc nghiệp vụ, bất biến, vòng đời/dọn dẹp, ranh giới bảo mật, thuật toán không hiển nhiên và đánh đổi quan trọng. Giải thích vì sao code tồn tại hoặc điều gì phải luôn đúng; không mô tả cú pháp hiển nhiên, phép gán, import hay từng dòng. Cập nhật comment khi hành vi thay đổi và xóa comment đã lỗi thời.

## Thận trọng

`src/pip/player.ts` quản lý việc di chuyển và dọn dẹp. `public/manifest.json` phải khớp với các file được tạo ra. Xem `docs/` để biết vòng đời, quyết định, kiểm thử, phạm vi sản phẩm và các giới hạn.
