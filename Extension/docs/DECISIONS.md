# Quyết định

## ADR-001: Document PiP

**Quyết định:** dùng Document Picture-in-Picture, không dùng native video PiP. **Lý do:** cho phép controls tùy chỉnh và UI phụ đề mà không có hover overlay native của Chrome. **Hệ quả:** yêu cầu Chrome hiện tại.

## ADR-002: Core player thuần

**Quyết định:** giữ logic di chuyển/player trong DOM TypeScript. **Lý do:** vòng đời HTMLVideoElement thuộc về page và tài liệu PiP; cách này tránh phụ thuộc framework. Svelte chỉ dùng cho popup/options UI.

## ADR-003: Di chuyển video hiện có

**Quyết định:** di chuyển video thay vì clone source. **Lý do:** stream blob/MSE/authenticated thường không thể tạo lại. **Hệ quả:** website phụ thuộc DOM xung quanh có thể không hoạt động.

## ADR-004: Chuẩn hóa phụ đề

**Quyết định:** SRT parse thành `SubtitleCue[]`. **Lý do:** parser tương lai có thể đưa dữ liệu vào cùng renderer và search layer.

## ADR-005: Chỉ local

**Quyết định:** không backend hoặc telemetry. **Lý do:** file phụ đề và hành vi xem giữ trên thiết bị.
