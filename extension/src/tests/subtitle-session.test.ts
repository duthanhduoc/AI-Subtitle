import { expect, it } from 'vitest';
import { sessionForUrl } from '../content/subtitle-session';

it('keeps subtitle state on the same URL and clears it on URL changes', () => {
	const session = {
		url: 'https://example.com/watch/1',
		tracks: [{ name: 'movie.srt', text: 'subtitle' }],
		activeTrackIndex: 0
	};

	expect(sessionForUrl(session, session.url)).toBe(session);
	expect(sessionForUrl(session, 'https://example.com/watch/2')).toEqual({
		url: 'https://example.com/watch/2',
		tracks: []
	});
});
