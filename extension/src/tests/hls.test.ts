import { expect, test } from 'vitest';
import { findMarkedVideoHlsUrls, firstHlsVariant, formatHlsResolutions, parseHlsDuration, preferTopFrameHls, selectPrimaryHls } from '../shared/hls';

test('parses VOD and live HLS durations', () => {
	const vod = '#EXTINF:6,\n1.ts\n#EXTINF:4.5,\n2.ts\n#EXT-X-ENDLIST';
	expect(parseHlsDuration(vod)).toBe(10.5);
	expect(parseHlsDuration('#EXTINF:6,\n1.ts')).toBe('Live');
	expect(firstHlsVariant('#EXT-X-STREAM-INF:BANDWIDTH=1\nlow/index.m3u8', 'https://example.com/master.m3u8')).toBe('https://example.com/low/index.m3u8');
});
import type { HlsUrl } from '../shared/messages';

const entry = (url: string): HlsUrl => ({ url, frameId: 0, seenAt: 0 });

test('shows every unique HLS playlist', () => {
	const master = entry('https://stream.example/video.m3u8?token=1');
	const rendition = entry('https://cdn.example/rendition.m3u8?token=1');

	expect(selectPrimaryHls([rendition, master, rendition])).toEqual([rendition, master]);
});

test('formats HLS resolutions as unique height labels', () => {
	expect(formatHlsResolutions('256×144, 426x240, 1920×1080, 1920×1080')).toBe('144p, 240p, 1080p');
	expect(formatHlsResolutions('Unknown')).toBe('Unknown');
});

test('prefers page HLS over unrelated iframe streams', () => {
	const page = entry('https://surrit.com/video/playlist.m3u8');
	const ad = {
		...entry('https://ads.example/master.m3u8'),
		frameId: 7
	};

	expect(preferTopFrameHls([ad, page])).toEqual([page]);
	expect(selectPrimaryHls([ad, page])).toEqual([ad, page]);
	expect(preferTopFrameHls([ad])).toEqual([ad]);
});

test('finds the HLS instance attached to the selected video', () => {
	const attributes = new Map([['data-custom-pip-hls-target', 'marker-1']]);
	const video = {
		getAttribute: (name: string) => attributes.get(name) ?? null,
		removeAttribute: (name: string) => attributes.delete(name)
	};
	const scope = {
		hls: { media: video, url: '/main/playlist.m3u8' },
		adHls: { media: {}, url: '/ads/stream.m3u8' }
	};
	const root = { querySelectorAll: () => [video] } as unknown as ParentNode;

	expect(findMarkedVideoHlsUrls('marker-1', scope, root, 'https://example.com/watch')).toEqual(['https://example.com/main/playlist.m3u8']);
	expect(attributes.has('data-custom-pip-hls-target')).toBe(false);
});
