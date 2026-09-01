// ENSURE_CONTENT là đường dự phòng để nạp content bundle vào tab đã mở trước
// khi extension được reload. Bundle có guard riêng để ngăn đăng ký listener trùng.
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
	if (!message || typeof message !== 'object' || !('type' in message) || (message as { type: unknown }).type !== 'ENSURE_CONTENT') return;
	const tabId = sender.tab?.id ?? (message as { tabId?: number }).tabId;
	if (!tabId) {
		sendResponse({ ok: false, error: 'No active tab.' });
		return;
	}
	// Helper chỉ báo rằng lần thử dự phòng đã hoàn tất; message gửi tiếp đến tab
	// sẽ báo lỗi nếu Chrome không cho phép truy cập trang.
	void chrome.scripting
		.executeScript({
			target: { tabId, allFrames: false },
			files: ['content.js']
		})
		.then(
			() => sendResponse({ ok: true }),
			() => sendResponse({ ok: true })
		);
	// Giữ kênh phản hồi của Chrome mở cho đến khi executeScript hoàn tất.
	return true;
});

const HLS_STORAGE_KEY = 'hlsByTab';
const hlsByTab = new Map<number, HlsUrl[]>();
let pendingWrite = Promise.resolve();
const cacheReady = chrome.storage.session
	.get(HLS_STORAGE_KEY)
	.then((stored) => {
		const entries = stored[HLS_STORAGE_KEY] as Record<string, HlsUrl[]> | undefined;
		for (const [tabId, urls] of Object.entries(entries ?? {})) hlsByTab.set(Number(tabId), urls);
	})
	.catch(() => undefined);

function persistHlsCache() {
	const snapshot = Object.fromEntries(hlsByTab);
	pendingWrite = pendingWrite.catch(() => undefined).then(() => chrome.storage.session.set({ [HLS_STORAGE_KEY]: snapshot }));
	return pendingWrite;
}

function clearHlsCache(tabId: number) {
	hlsByTab.delete(tabId);
	return persistHlsCache();
}

chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
		const tabId = details.tabId;
		if (tabId < 0 || !/\.m3u8(?:$|[?#])/i.test(details.url)) return;
		void cacheReady.then(() => {
			const current = hlsByTab.get(tabId) ?? [];
			// Giữ thứ tự ổn định: request trùng không di chuyển URL, URL mới nối vào cuối.
			const next = current.some((entry) => entry.url === details.url)
				? current
				: [...current, { url: details.url, frameId: details.frameId, seenAt: Date.now() }];
			hlsByTab.set(tabId, next);
			return persistHlsCache();
		});
	},
	{ urls: ['*://*/*.m3u8*'] }
);

// Document mới và navigation SPA đều bắt đầu nội dung mới nên phải tách cache HLS.
chrome.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
	if (tabId < 0 || frameId !== 0) return;
	void cacheReady.then(() => clearHlsCache(tabId));
});
chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId }) => {
	if (tabId < 0 || frameId !== 0) return;
	void cacheReady.then(() => clearHlsCache(tabId));
});
chrome.tabs.onRemoved.addListener((tabId) => {
	void cacheReady.then(() => clearHlsCache(tabId));
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
	if (!message || typeof message !== 'object' || !('type' in message)) return;
	if ((message as { type?: unknown }).type !== 'GET_HLS_URLS') return;
	const tabId = (message as { tabId?: unknown }).tabId ?? sender.tab?.id;
	if (typeof tabId !== 'number') {
		sendResponse({ ok: false, error: 'No tab selected.' });
		return;
	}
	void cacheReady.then(() => sendResponse({ ok: true, value: hlsByTab.get(tabId) ?? [] }));
	return true;
});
import type { HlsUrl } from '../shared/messages';
