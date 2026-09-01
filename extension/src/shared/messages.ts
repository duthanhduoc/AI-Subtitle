// Message phải tuần tự hóa được vì popup và content script nằm trong
// các execution context riêng của extension. Candidate ID đại diện cho DOM node;
// direct media URL được đưa vào cho source có thể mở ở tab mới.
export type Candidate = {
	id: string;
	source?: string;
	width: number;
	height: number;
	duration: number;
	playing: boolean;
	score: number;
};
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export type PlayerCommand = { type: 'GET_CANDIDATES' } | { type: 'OPEN_PIP'; id: string };
export type Message = PlayerCommand | { type: 'MARK_HLS_TARGET'; id: string; marker: string };
export type PlayerMessage = PlayerCommand & { tabId: number };

export type HlsUrl = { url: string; frameId: number; seenAt: number };

// Message runtime là một input boundary dù caller nội bộ dùng TypeScript union.
// Handler vẫn sanitize từng giá trị payload trước khi sử dụng.
export function isMessage(value: unknown): value is Message {
	if (!value || typeof value !== 'object' || !('type' in value)) return false;
	const message = value as { type?: unknown };
	return (
		message.type === 'GET_CANDIDATES' ||
		(message.type === 'OPEN_PIP' && typeof (value as { id?: unknown }).id === 'string') ||
		(message.type === 'MARK_HLS_TARGET' && typeof (value as { id?: unknown }).id === 'string' && typeof (value as { marker?: unknown }).marker === 'string')
	);
}

export function isPlayerMessage(value: unknown): value is PlayerMessage {
	return isMessage(value) && value.type !== 'MARK_HLS_TARGET' && 'tabId' in value && Number.isInteger((value as { tabId?: unknown }).tabId);
}
