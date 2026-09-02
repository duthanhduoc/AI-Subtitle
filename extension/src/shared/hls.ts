import type { HlsUrl } from './messages';

export function preferTopFrameHls(entries: HlsUrl[]) {
	const topFrame = entries.filter(({ frameId }) => frameId === 0);
	return topFrame.length ? topFrame : entries;
}

// Hàm này được truyền trực tiếp vào chrome.scripting.executeScript và phải
// tự chứa vì thực thi trong MAIN-world không dùng được module import.
export function findMarkedVideoHlsUrls(
	marker: string,
	scope: Record<string, unknown> = window as unknown as Record<string, unknown>,
	root: ParentNode = document,
	pageUrl: string = location.href
): string[] {
	const video = [...root.querySelectorAll('video')].find((element) => element.getAttribute('data-custom-pip-hls-target') === marker);
	if (!video) return [];
	video.removeAttribute('data-custom-pip-hls-target');

	const urls = new Set<string>();
	for (const key of Object.getOwnPropertyNames(scope)) {
		try {
			const value = scope[key];
			if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
			const hls = value as { media?: unknown; url?: unknown };
			if (hls.media !== video || typeof hls.url !== 'string') continue;
			const url = new URL(hls.url, pageUrl).href;
			if (/\.m3u8(?:$|[?#])/i.test(url)) urls.add(url);
		} catch {
			// Window property có thể là cross-origin hoặc là getter ném exception.
			continue;
		}
	}
	return [...urls];
}

export function isLikelyMasterHls(url: string) {
	try {
		return !/(?:^|\/)(?:audio|video|rendition(?:-[^/]+)?)\.m3u8$/i.test(new URL(url).pathname);
	} catch {
		return false;
	}
}

export function selectPrimaryHls(entries: HlsUrl[]) {
	// Chỉ loại URL trùng; mọi frame và mọi loại playlist còn lại đều được hiển thị.
	return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}

export function formatHlsResolutions(value: string) {
	// Manifest dùng WIDTH×HEIGHT, còn popup chỉ cần nhãn chiều cao quen thuộc như 1080p.
	const heights = [...value.matchAll(/\d+\s*[×x]\s*(\d+)/gi)].map(([, height]) => `${height}p`);
	return heights.length ? [...new Set(heights)].join(', ') : value;
}

export function parseHlsDuration(manifest: string): number | 'Live' | undefined {
	const values = [...manifest.matchAll(/#EXTINF:\s*([\d.]+)/gi)].map(([, value]) => Number(value));
	if (!values.length || values.some((value) => !Number.isFinite(value))) return undefined;
	return /#EXT-X-ENDLIST\b/i.test(manifest) ? values.reduce((total, value) => total + value, 0) : 'Live';
}

export function firstHlsVariant(manifest: string, baseUrl: string): string | undefined {
	const match = manifest.match(/#EXT-X-STREAM-INF:[^\r\n]*\r?\n([^\r\n#]+)/i);
	if (!match) return undefined;
	const variant = match[1];
	if (!variant) return undefined;
	try {
		return new URL(variant.trim(), baseUrl).href;
	} catch {
		return undefined;
	}
}
