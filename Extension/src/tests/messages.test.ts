import { describe, expect, it } from 'vitest';
import { isPlayerMessage } from '../shared/messages';

describe('player page messages', () => {
	it('requires a valid target tab and message payload', () => {
		expect(isPlayerMessage({ type: 'GET_CANDIDATES', tabId: 7 })).toBe(true);
		expect(isPlayerMessage({ type: 'OPEN_PIP', id: 'video-1', tabId: 7 })).toBe(true);
		expect(isPlayerMessage({ type: 'GET_CANDIDATES' })).toBe(false);
		expect(isPlayerMessage({ type: 'OPEN_PIP', tabId: 7 })).toBe(false);
		expect(
			isPlayerMessage({
				type: 'MARK_HLS_TARGET',
				id: 'video-1',
				marker: 'marker-1',
				tabId: 7
			})
		).toBe(false);
	});
});
