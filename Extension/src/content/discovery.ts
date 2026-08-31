import { scoreVideo, type VideoMetrics } from './scoring';
import type { Candidate } from '../shared/messages';

// DOM nodes cannot cross the extension message boundary. Assign ephemeral IDs
// while retaining only weak references, so removed videos can still be collected.
const ids = new WeakMap<HTMLVideoElement, string>();
let sequence = 0;
const idFor = (video: HTMLVideoElement) => ids.get(video) ?? (ids.set(video, `video-${++sequence}`), ids.get(video)!);

// Search every DOM tree the page exposes. Closed shadow roots and cross-origin
// frames remain inaccessible by browser design and are intentionally skipped.
function videos(root: ParentNode = document): HTMLVideoElement[] {
	const result = [...root.querySelectorAll('video')];
	for (const el of root.querySelectorAll('*')) if (el.shadowRoot) result.push(...videos(el.shadowRoot));
	for (const frame of root.querySelectorAll('iframe')) if (frame.contentDocument) result.push(...videos(frame.contentDocument));
	return result;
}

// Capture only signals needed for ranking; the popup receives no page DOM or
// media source details.
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
export function discover(): Candidate[] {
	// Zero-score elements are decorative/tiny/unusable. A deterministic tie-break
	// prevents the popup selection from jumping between otherwise equal scans.
	return videos()
		.map((element) => {
			const v = metrics(element);
			return {
				id: idFor(element),
				width: v.width,
				height: v.height,
				duration: v.duration,
				playing: v.playing,
				score: scoreVideo(v)
			};
		})
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
// Resolve the ID again at action time because sites can replace video elements
// between discovery and the user's click.
export function getVideo(id: string): HTMLVideoElement | undefined {
	return videos().find((video) => ids.get(video) === id);
}
