import { discover, getVideo } from './discovery';
import { isMessage, type Reply } from '../shared/messages';
import { openPlayer } from '../pip/player';
import { sessionForUrl, type SubtitleSession } from './subtitle-session';

type ContentWindow = Window & {
	__customPipContentLoaded?: boolean;
	__customPipSubtitleSession?: SubtitleSession;
};
const contentWindow = window as ContentWindow;
contentWindow.__customPipSubtitleSession ??= {
	url: location.href,
	tracks: []
};

// Manifest và popup đều có thể nạp content.js. Lưu guard trên `window` để việc
// inject dự phòng không đăng ký message listener trùng.
if (!contentWindow.__customPipContentLoaded) {
	contentWindow.__customPipContentLoaded = true;
	chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (reply: Reply<unknown>) => void) => {
		if (!isMessage(message)) return;

		// SPA navigation có thể dùng lại content-script world này. Coi URL mới là
		// một media session mới để phụ đề của tiêu đề trước biến mất.
		const currentSession = contentWindow.__customPipSubtitleSession!;
		const nextSession = sessionForUrl(currentSession, location.href);
		contentWindow.__customPipSubtitleSession = nextSession;
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
			return;
		}

		// Preference của extension dùng chung cho mọi trang, còn subtitle track chỉ
		// thuộc session trang hiện tại. controlsDelay vẫn được lưu cho tính năng tự ẩn dự kiến.
		void chrome.storage.local
			.get({ fontSize: 'medium', background: 'medium', controlsDelay: 2200 })
			.then((settings) => openPlayer(video, settings, nextSession))
			.then(() => sendResponse({ ok: true, value: null }))
			.catch((error: unknown) =>
				sendResponse({
					ok: false,
					error: error instanceof Error ? error.message : 'Could not open Picture-in-Picture.'
				})
			);
		// Chrome yêu cầu `true` khi sendResponse sẽ chạy bất đồng bộ.
		return true;
	});
}
