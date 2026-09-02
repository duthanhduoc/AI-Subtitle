import '@videojs/html/media/hlsjs-video';
import '@videojs/html/video/player';
import '@videojs/html/video/skin';
import '@videojs/html/video/skin.css';
import './player.css';
import { discover } from '../content/discovery';
import { openPlayer } from '../pip/player';
import { isPlayerMessage, type Reply } from '../shared/messages';
import { srtToVtt } from '../subtitles/srt';
import { applyCaptionStyle, type CaptionStyle } from '../subtitles/vtt';
import { Captions, ChevronRight, PictureInPicture2, Upload, type IconNode } from 'lucide';
import { ImageFragmentLoader } from './image-fragment-loader';

const params = new URLSearchParams(location.search);
const source = params.get('src');
const root = document.getElementById('app')!;
let hlsMedia: HTMLElementTagNameMap['hlsjs-video'] | undefined;
let subtitleTrack: HTMLTrackElement | undefined;
let subtitleUrl: string | undefined;
// Giữ VTT gốc để Default có thể bỏ riêng stylesheet do extension thêm vào.
let subtitleSource: { name: string; vtt: string } | undefined;
let captionSettings: CaptionSettings | undefined;
const svgNamespace = 'http://www.w3.org/2000/svg';

const lucide = (document: Document, [tag, attributes, children]: IconNode): SVGElement => {
	const element = document.createElementNS(svgNamespace, tag);
	for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
	element.append(...(children ?? []).map((child) => lucide(document, child)));
	return element;
};

const isVtt = (value: string): boolean => /^\uFEFF?WEBVTT(?:[\t ]|\r?\n|$)/.test(value);

const subtitleFileToVtt = async (file: File): Promise<string> => {
	const text = await file.text();
	if (isVtt(text)) return text.replace(/^\uFEFF/, '');
	return srtToVtt(text);
};

const clearSubtitleTrack = () => {
	subtitleTrack?.remove();
	subtitleTrack = undefined;
	if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
	subtitleUrl = undefined;
};

const replaceSubtitleTrack = (media: HTMLElementTagNameMap['hlsjs-video'], vtt: string, name: string): void => {
	// Native caption không có API sửa stylesheet đang chạy; thay Blob track là cách để
	// Video.js và Document PiP cùng nhận một VTT đã cập nhật.
	const nextUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
	const nextTrack = document.createElement('track');
	nextTrack.kind = 'subtitles';
	nextTrack.src = nextUrl;
	nextTrack.srclang = 'vi';
	nextTrack.label = name;
	nextTrack.default = true;
	clearSubtitleTrack();
	subtitleUrl = nextUrl;
	subtitleTrack = nextTrack;
	media.append(nextTrack);
};

const createTooltip = (id: string, label: string): HTMLElement => {
	const tooltip = document.createElement('media-tooltip');
	tooltip.id = id;
	tooltip.className = 'media-surface media-tooltip';
	tooltip.setAttribute('side', 'top');
	tooltip.textContent = label;
	return tooltip;
};

const createResolutionBadge = (media: HTMLElementTagNameMap['hlsjs-video']): HTMLElement => {
	const badge = document.createElement('span');
	badge.className = 'player-resolution-badge';
	badge.hidden = true;
	const update = () => {
		const { videoHeight } = media;
		const hasQualityOptions = (media.engine?.levels.length ?? 0) > 1;
		badge.textContent = `${videoHeight}p`;
		badge.setAttribute('aria-label', hasQualityOptions ? 'Video resolution; quality selection available' : 'Video resolution');
		badge.title = hasQualityOptions ? 'Multiple video qualities available in Settings' : 'Single video quality';
		badge.dataset.quality = hasQualityOptions ? 'multiple' : 'single';
		badge.hidden = !badge.textContent;
	};
	media.addEventListener('loadedmetadata', update);
	media.addEventListener('resize', update);
	media.addEventListener('durationchange', update);
	update();
	return badge;
};

type CaptionSettings = { setAvailable: () => void; resetToDefaults: () => void };

const createCaptionPreferencesDialog = (): HTMLDialogElement => {
	const dialog = document.createElement('dialog');
	dialog.className = 'extension-caption-help-dialog';
	const title = document.createElement('h2');
	title.textContent = 'Caption background help';
	const text = document.createElement('p');
	text.textContent = 'Device caption preferences can override subtitle backgrounds.';
	const steps = document.createElement('p');
	steps.append('Open ', Object.assign(document.createElement('strong'), { textContent: 'Caption Preferences' }), ', then choose ', Object.assign(document.createElement('strong'), { textContent: 'Outline Text' }), '.');
	const actions = document.createElement('div');
	actions.className = 'extension-caption-help-actions';
	const close = document.createElement('button');
	close.type = 'button';
	close.textContent = 'Got it';
	close.addEventListener('click', () => dialog.close());
	const open = document.createElement('button');
	open.type = 'button';
	open.className = 'extension-caption-help-open';
	open.textContent = 'Open Caption Preferences';
	open.addEventListener('click', () => {
		// Trang Accessibility của Chrome có liên kết mở Caption Preferences của macOS.
		void chrome.tabs.create({ url: 'chrome://settings/accessibility' });
	});
	actions.append(close, open);
	dialog.append(title, text, steps, actions);
	document.body.append(dialog);
	return dialog;
};

const createCaptionSettings = (media: HTMLElementTagNameMap['hlsjs-video'], settingsMenu: HTMLElement): CaptionSettings => {
	// Settings menu của Video.js hỗ trợ panel cùng cấp qua commandfor; dùng đúng contract
	// này để keyboard, focus và animation submenu giữ nguyên như control có sẵn.
	// Video.js gán id runtime cho menu gốc, nên nhận diện bằng class ổn định thay vì id.
	const main = settingsMenu.querySelector<HTMLElement>('media-menu-content.media-menu__content');
	if (!main) return { setAvailable: () => undefined, resetToDefaults: () => undefined };
	const item = document.createElement('media-menu-item');
	item.className = 'media-menu__item media-menu__item--submenu';
	item.setAttribute('commandfor', 'extension-caption-settings-menu');
	item.hidden = true;
	const icon = lucide(document, Captions);
	icon.classList.add('media-icon');
	icon.setAttribute('aria-hidden', 'true');
	const label = document.createElement('span');
	label.textContent = 'Subtitle options';
	const hint = document.createElement('span');
	hint.className = 'media-menu__hint';
	const chevron = lucide(document, ChevronRight);
	chevron.classList.add('media-icon', 'media-menu__chevron');
	chevron.setAttribute('aria-hidden', 'true');
	hint.append(chevron);
	item.append(icon, label, hint);
	main.append(item);

	const panel = document.createElement('media-menu-content');
	panel.id = 'extension-caption-settings-menu';
	panel.className = 'media-menu__panel';
	const back = document.createElement('media-menu-item');
	back.className = 'media-menu__back';
	const backIcon = lucide(document, ChevronRight);
	backIcon.classList.add('media-icon', 'media-menu__chevron', 'media-icon--flipped');
	backIcon.setAttribute('aria-hidden', 'true');
	back.append(backIcon, document.createTextNode('Subtitle options'));
	const help = document.createElement('button');
	help.type = 'button';
	help.className = 'extension-caption-help';
	help.textContent = 'Background not applying? Learn how to fix it';
	const helpDialog = createCaptionPreferencesDialog();
	help.addEventListener('click', () => helpDialog.showModal());
	panel.append(back, help, document.createElement('media-menu-separator'));
	const defaults: CaptionStyle = {
		fontFamily: 'Arial',
		color: '#ffffff',
		fontSize: '100%',
		background: 'system',
		backgroundOpacity: 'system'
	};
	let style = { ...defaults };
	let overrides: Partial<CaptionStyle> = { fontSize: defaults.fontSize };
	const selects: Array<{ key: keyof CaptionStyle; select: HTMLSelectElement }> = [];
	const apply = () => {
		if (!subtitleSource) return;
		// Chỉ ghi option người dùng vừa đổi để không làm lệch layout caption native.
		replaceSubtitleTrack(media, applyCaptionStyle(subtitleSource.vtt, overrides), subtitleSource.name);
	};
	const addChoices = <K extends keyof CaptionStyle>(label: string, key: K, choices: Array<[CaptionStyle[K], string]>) => {
		const row = document.createElement('div');
		row.className = 'media-menu__item extension-caption-select-row';
		const rowLabel = document.createElement('span');
		rowLabel.textContent = label;
		const select = document.createElement('select');
		select.className = 'extension-caption-select';
		select.id = `extension-caption-${key}`;
		select.name = `caption-${key}`;
		select.setAttribute('aria-label', label);
		for (const [value, name] of choices) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = name;
			select.append(option);
		}
		select.value = style[key];
		select.addEventListener('change', () => {
			const value = select.value as CaptionStyle[K];
			style = { ...style, [key]: value };
			overrides = { ...overrides, [key]: value };
			apply();
		});
		selects.push({ key, select });
		row.addEventListener('click', (event) => {
			// Cả hàng là vùng chạm để người dùng không phải nhắm chính xác vào select.
			if (event.target === select) return;
			// showPicker mở dropdown native từ thao tác người dùng; click() chỉ phát sự kiện.
			try {
				select.showPicker();
			} catch {
				select.click();
			}
		});
		row.append(rowLabel, select);
		panel.append(row);
	};
	addChoices('Font', 'fontFamily', [
		['Arial', 'Sans-serif'],
		['Georgia', 'Serif'],
		['monospace', 'Monospace']
	]);
	addChoices('Text color', 'color', [
		['#ffffff', 'White'],
		['#ffeb3b', 'Yellow'],
		['#00ff00', 'Green'],
		['#00e5ff', 'Cyan'],
		['#0000ff', 'Blue'],
		['#ff00ff', 'Magenta'],
		['#ff0000', 'Red'],
		['#000000', 'Black']
	]);
	addChoices('Font size', 'fontSize', [
		['system', 'System default'],
		['50%', '50%'],
		// 75% làm Chromium làm tròn line box lệch một pixel trên một số kích thước video.
		['70%', '75%'],
		['100%', '100%'],
		['150%', '150%']
	]);
	addChoices('Background', 'background', [
		['system', 'System default'],
		['#000000', 'Black'],
		['#ffffff', 'White'],
		['#ffeb3b', 'Yellow'],
		['#00ff00', 'Green'],
		['#00e5ff', 'Cyan'],
		['#0000ff', 'Blue'],
		['#ff00ff', 'Magenta'],
		['#ff0000', 'Red'],
		['transparent', 'Transparent']
	]);
	addChoices('Background opacity', 'backgroundOpacity', [
		['system', 'System default'],
		['0', '0%'],
		['0.5', '50%'],
		['0.75', '75%'],
		['1', '100%']
	]);
	const resetToDefaults = () => {
		if (!subtitleSource) return;
		// Default giữ background theo hệ thống nhưng luôn neo cỡ chữ 100% cho UI nhất quán.
		style = { ...defaults };
		overrides = { fontSize: defaults.fontSize };
		for (const { key, select } of selects) select.value = style[key];
		replaceSubtitleTrack(media, applyCaptionStyle(subtitleSource.vtt, overrides), subtitleSource.name);
	};
	const reset = document.createElement('media-menu-item');
	reset.className = 'media-menu__item extension-caption-default';
	reset.textContent = 'Default';
	// Menu đóng submenu sau `select`; Default chỉ reset style nên phải giữ người dùng ở panel này.
	reset.addEventListener('select', (event) => event.preventDefault());
	reset.addEventListener('click', resetToDefaults);
	panel.append(document.createElement('media-menu-separator'), reset);
	settingsMenu.append(panel);
	return {
		setAvailable: () => {
			item.hidden = false;
		},
		resetToDefaults
	};
};

const createSubtitleTools = (media: HTMLElementTagNameMap['hlsjs-video']): HTMLElement => {
	const tools = document.createElement('div');
	tools.className = 'player-subtitle-tools';

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.srt,.vtt,text/vtt,application/x-subrip';
	input.hidden = true;

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'player-subtitle-upload media-button media-button--subtle';
	button.id = 'extension-subtitle-upload-trigger';
	const icon = lucide(document, Upload);
	icon.classList.add('media-icon');
	icon.setAttribute('aria-hidden', 'true');
	// Icon mô tả thao tác upload, còn nhãn CC cho biết nút này dành cho phụ đề.
	button.append(icon, document.createTextNode('CC'));
	button.setAttribute('aria-label', 'Upload SRT or VTT subtitle');
	button.setAttribute('commandfor', 'extension-subtitle-upload-tooltip');
	button.addEventListener('click', () => input.click());

	const tooltip = createTooltip('extension-subtitle-upload-tooltip', 'Upload subtitle');

	const status = document.createElement('span');
	status.className = 'player-subtitle-status';
	status.hidden = true;
	status.setAttribute('role', 'status');

	input.addEventListener('change', () => {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		void subtitleFileToVtt(file)
			.then((vtt) => {
				subtitleSource = { name: file.name, vtt };
				// Subtitle mới luôn bắt đầu ở 100%, kể cả khi menu settings chưa khởi tạo xong.
				if (captionSettings) captionSettings.resetToDefaults();
				else replaceSubtitleTrack(media, applyCaptionStyle(vtt, { fontSize: '100%' }), file.name);
				captionSettings?.setAvailable();
				tooltip.textContent = 'Replace subtitle';
				status.textContent = file.name;
				status.dataset.error = 'false';
			})
			.catch((error: unknown) => {
				status.textContent = error instanceof Error ? error.message : 'Could not load subtitle.';
				status.dataset.error = 'true';
			});
	});

	tools.append(button, tooltip, input, status);
	return tools;
};

const createCustomPipControls = (): DocumentFragment => {
	const controls = document.createDocumentFragment();
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'player-custom-pip media-button media-button--subtle media-button--icon';
	button.id = 'extension-custom-pip-trigger';
	button.setAttribute('aria-label', 'Open extension Picture-in-Picture');
	button.setAttribute('commandfor', 'extension-custom-pip-tooltip');
	const icon = lucide(document, PictureInPicture2);
	icon.classList.add('media-icon');
	icon.setAttribute('aria-hidden', 'true');
	button.append(icon);

	const tooltip = createTooltip('extension-custom-pip-tooltip', 'Open Custom PiP');
	button.addEventListener('click', () => {
		const media = hlsMedia;
		if (!media) return;
		void openPlayer(media, media).catch((error: unknown) => {
			tooltip.textContent = error instanceof Error ? error.message : 'Could not open extension Picture-in-Picture.';
		});
	});
	controls.append(button, tooltip);
	return controls;
};

const replaceNativePip = (skin: HTMLElement): void => {
	const shadowRoot = skin.shadowRoot;
	if (!shadowRoot) return;

	const hideStyle = document.createElement('style');
	// DOM của video-skin ổn định; CSS giữ native control bị ẩn ngay cả khi
	// trạng thái khả dụng được tính lại sau khi Document PiP khôi phục media.
	hideStyle.textContent = `
		media-pip-button { display: none !important; }
		/* Giữ controls nổi trực tiếp trên video, không phủ gradient toàn khung. */
		media-controls-backdrop { background-image: none !important; }
		.player-subtitle-upload {
			width: auto;
			min-width: 0;
			gap: 0.35rem;
			padding: 0 0.5rem;
		}
		.player-subtitle-upload .media-icon {
			width: 1rem;
			height: 1rem;
			flex-shrink: 0;
		}
		.player-resolution-badge {
			padding: 0 0.55rem;
		}
		.extension-caption-help {
			align-self: flex-start;
			padding: 0.2rem 0.7rem 0.4rem;
			color: rgb(255 255 255 / 68%);
			background: transparent;
			border: 0;
			font: 0.75rem/1.2 system-ui, sans-serif;
			text-decoration: underline;
			text-underline-offset: 0.15em;
			cursor: pointer;
		}
		.extension-caption-help:hover,
		.extension-caption-help:focus-visible {
			color: white;
		}
		.extension-caption-select-row {
			position: relative;
			cursor: default;
		}
		.extension-caption-select {
			appearance: none;
			max-width: 58%;
			padding: 0 1.25rem 0 0.5rem;
			border: 0;
			outline: 0;
			color: rgb(255 255 255 / 72%);
			background: transparent;
			font: inherit;
			text-align: right;
			cursor: pointer;
		}
		.extension-caption-select-row::after {
			position: absolute;
			right: 0.4rem;
			content: '›';
			color: rgb(255 255 255 / 72%);
			font-size: 1.5em;
			line-height: 1;
			pointer-events: none;
		}
		.extension-caption-select:focus-visible {
			outline: 2px solid white;
			outline-offset: 2px;
			border-radius: 0.2rem;
		}
		.extension-caption-default {
			cursor: pointer;
		}
		#extension-caption-settings-menu .extension-caption-default[data-highlighted],
		#extension-caption-settings-menu .extension-caption-default:hover,
		#extension-caption-settings-menu .extension-caption-default:focus-visible {
			background: rgb(255 255 255 / 12%) !important;
		}
	`;
	shadowRoot.append(hideStyle);

	const nativePip = shadowRoot.querySelector<HTMLElement>('media-pip-button');
	const pipGroup = nativePip?.parentElement;
	if (nativePip && pipGroup) pipGroup.insertBefore(createCustomPipControls(), nativePip);
	const settingsMenu = shadowRoot.querySelector<HTMLElement>('#settings-menu');
	if (hlsMedia && settingsMenu) {
		captionSettings = createCaptionSettings(hlsMedia, settingsMenu);
		// Upload có thể hoàn tất trước frame khởi tạo shadow menu; trạng thái sẵn có
		// phải được áp lại để mục Subtitle options không bị giữ hidden.
		if (subtitleSource) captionSettings.setAvailable();
	}
};

void chrome.tabs.getCurrent().then((tab) => {
	if (!tab?.id) return;
	chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (reply: Reply<unknown>) => void) => {
		if (!isPlayerMessage(message) || message.tabId !== tab.id) return;
		sendResponse({ ok: true, value: discover() });
	});
});

if (!source) {
	root.textContent = 'No media URL was provided.';
} else {
	const player = document.createElement('video-player');
	const skin = document.createElement('video-skin');
	hlsMedia = document.createElement('hlsjs-video');

	hlsMedia.slot = 'media';
	hlsMedia.source = {
		src: source,
		preferPlayback: 'mse',
		// fLoader chỉ xử lý fragment HLS; progressive tắt để loader luôn nhận đủ segment
		// trước khi kiểm tra wrapper PNG và chuyển phần MPEG-TS cho hls.js.
		engine: { hlsJs: { fLoader: ImageFragmentLoader, progressive: false } }
	};
	hlsMedia.setAttribute('playsinline', '');
	hlsMedia.setAttribute('preload', 'auto');
	skin.append(hlsMedia);
	const subtitleTools = createSubtitleTools(hlsMedia);
	const resolutionBadge = createResolutionBadge(hlsMedia);
	subtitleTools.append(resolutionBadge);
	skin.append(subtitleTools);
	player.append(skin);
	root.append(player);

	window.addEventListener('pagehide', clearSubtitleTrack, { once: true });

	requestAnimationFrame(() => {
		const shadowRoot = skin.shadowRoot;
		const controls = shadowRoot?.querySelector<HTMLElement>('.media-controls--primary .media-button-group:last-child');
		const settings = controls?.querySelector<HTMLElement>('#settings-trigger');
		const captions = controls?.querySelector<HTMLElement>('media-captions-button');
		const subtitleTools = skin.querySelector<HTMLElement>(':scope > .player-subtitle-tools');

		if (controls && settings && subtitleTools) {
			subtitleTools.style.position = 'static';
			subtitleTools.style.display = 'contents';
			controls.insertBefore(subtitleTools, settings);
		}
		// Badge nằm sau thời gian và sát nút captions, trước control upload phụ đề.
		if (controls && captions) controls.insertBefore(resolutionBadge, captions);

		replaceNativePip(skin);

		shadowRoot?.querySelector<HTMLElement>('media-play-button')?.focus({ preventScroll: true });
	});
}
