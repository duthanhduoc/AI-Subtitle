import { discover, getVideo } from './discovery';
import { isMessage, type Reply } from '../shared/messages';

type ContentWindow = Window & {
	__customPipContentLoaded?: boolean;
};
const contentWindow = window as ContentWindow;

// Manifest và popup đều có thể nạp content.js. Lưu guard trên `window` để việc
// inject dự phòng không đăng ký message listener trùng.
if (!contentWindow.__customPipContentLoaded) {
	contentWindow.__customPipContentLoaded = true;
	chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (reply: Reply<unknown>) => void) => {
		if (!isMessage(message)) return;

		if (message.type === 'GET_CANDIDATES') {
			sendResponse({ ok: true, value: discover() });
			return;
		}
		// ID được cố ý tạo tạm thời; resolve lại sau khi người dùng chọn
		// vì website có thể đã thay player kể từ lần scan trước.
		const video = getVideo(message.id);
		if (!video) {
			sendResponse({
				ok: false,
				error: 'The selected video is no longer available. Reopen the extension.'
			});
			return;
		}

		if (message.type === 'MARK_HLS_TARGET') {
			// Marker nối isolated world của content script với một lần tra cứu ngắn trong
			// MAIN world mà không để lộ hoặc tuần tự hóa video element của trang.
			for (const marked of document.querySelectorAll('[data-custom-pip-hls-target]')) marked.removeAttribute('data-custom-pip-hls-target');
			video.setAttribute('data-custom-pip-hls-target', message.marker);
			sendResponse({ ok: true, value: null });
		}
	});
}
