import { scoreVideo, type VideoMetrics } from './scoring';
import type { Candidate } from '../shared/messages';

// DOM node không thể đi qua boundary message của extension. Gán ID tạm thời
// và chỉ giữ weak reference để video đã bị xóa vẫn có thể được thu gom.
const ids = new WeakMap<HTMLVideoElement, string>();
let sequence = 0;
const idFor = (video: HTMLVideoElement) => ids.get(video) ?? (ids.set(video, `video-${++sequence}`), ids.get(video)!);

// Tìm trong mọi DOM tree mà trang expose. Closed shadow root và frame cross-origin
// không thể truy cập theo thiết kế browser nên được chủ động bỏ qua.
function videos(root: ParentNode = document): HTMLVideoElement[] {
	const result = [...root.querySelectorAll('video')];
	for (const el of root.querySelectorAll('*')) if (el.shadowRoot) result.push(...videos(el.shadowRoot));
	for (const frame of root.querySelectorAll('iframe')) if (frame.contentDocument) result.push(...videos(frame.contentDocument));
	return result;
}

// Chỉ thu thập tín hiệu cần cho việc chấm điểm và nhãn nguồn; popup không nhận DOM trang.
function metrics(video: HTMLVideoElement): VideoMetrics {
	const rect = video.getBoundingClientRect();
	const style = getComputedStyle(video);
	const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
	const inViewport = rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
	return {
		width: Math.round(rect.width),
		height: Math.round(rect.height),
		visible,
		inViewport,
		playing: !video.paused && !video.ended,
		duration: video.duration,
		readyState: video.readyState
	};
}
const mediaSource = (video: HTMLVideoElement): string | undefined =>
	[video.currentSrc, video.src, ...[...video.querySelectorAll('source')].map((source) => source.src)].find((source) => /^https?:\/\//i.test(source));
export function discover(): Candidate[] {
	// Phần tử có điểm 0 thường là trang trí/quá nhỏ/không dùng được. Tie-break
	// xác định giúp lựa chọn trong popup không nhảy giữa các lần scan bằng điểm.
	return videos()
		.map((element) => {
			const v = metrics(element);
			return {
				id: idFor(element),
				frameId: 0,
				source: mediaSource(element),
				width: v.width,
				height: v.height,
				videoWidth: element.videoWidth,
				videoHeight: element.videoHeight,
				duration: v.duration,
				playing: v.playing,
				score: scoreVideo(v)
			};
		})
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
// Xác định lại ID tại thời điểm thao tác vì website có thể thay video element
// giữa lúc phát hiện và lúc người dùng click.
export function getVideo(id: string): HTMLVideoElement | undefined {
	return videos().find((video) => ids.get(video) === id);
}
