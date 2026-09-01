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

export function selectPrimaryHls(entries: HlsUrl[], resolutions: Record<string, string>) {
	// Player ở top-level có khả năng là nội dung trang hơn HLS do frame quảng cáo tải.
	// Giữ stream trong iframe làm fallback cho embed.
	const candidates = preferTopFrameHls(entries);
	const confirmedMasters = candidates.filter(({ url }) => {
		const resolution = resolutions[url];
		return resolution && resolution !== 'Unknown';
	});
	if (confirmedMasters.length) return confirmedMasters;

	const likelyMasters = candidates.filter(({ url }) => isLikelyMasterHls(url));
	return likelyMasters.length ? likelyMasters : candidates.slice(0, 1);
}
