import type { SubtitleState } from '../subtitles/types';

export type SubtitleSession = SubtitleState & { url: string };

// Mở lại PiP trên cùng trang sẽ giữ các track đã import. Thay đổi URL (bao gồm
// SPA navigation) là session xem mới và không được làm rò rỉ phụ đề của media trước.
export const sessionForUrl = (session: SubtitleSession, url: string): SubtitleSession => (session.url === url ? session : { url, tracks: [] });
