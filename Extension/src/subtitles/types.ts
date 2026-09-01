export interface SubtitleCue {
	id?: string;
	startTime: number;
	endTime: number;
	text: string;
}
export interface SubtitleTrack {
	cues: SubtitleCue[];
}
// Giữ text thô đã import trong page session. Track chỉ được parse khi được chọn,
// và không có nội dung phụ đề nào được upload hoặc ghi vào extension storage.
export interface StoredSubtitle {
	name: string;
	text: string;
}
export interface SubtitleState {
	// Object này được dùng chung qua các lần mở lại PiP trên URL hiện tại.
	tracks: StoredSubtitle[];
	activeTrackIndex?: number;
}
