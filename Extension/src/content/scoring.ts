export type VideoMetrics = {
	width: number;
	height: number;
	visible: boolean;
	inViewport: boolean;
	playing: boolean;
	duration: number;
	readyState: number;
};

// Xếp hạng video mà người dùng có khả năng đang xem nhất: trước hết phải có kích
// thước có ý nghĩa, sau đó vị trí trong viewport, playback, duration và readiness là các gợi ý mạnh.
export function scoreVideo(v: VideoMetrics): number {
	// Loại tracking pixel, thumbnail và player preload đang bị ẩn.
	if (!v.visible || v.width < 120 || v.height < 70) return 0;
	// Giới hạn area để layout cực đoan không lấn át mọi tín hiệu hành vi khác.
	const area = Math.min(v.width * v.height, 3840 * 2160) / 1000;
	return area + (v.inViewport ? 1000 : 0) + (v.playing ? 500 : 0) + (v.duration >= 60 ? 250 : v.duration > 5 ? 50 : 0) + v.readyState * 5;
}
