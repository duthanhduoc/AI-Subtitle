import { findCue } from '../subtitles/search';
import { parseSrt } from '../subtitles/srt';
import type { StoredSubtitle, SubtitleState, SubtitleTrack } from '../subtitles/types';
import { formatTime } from '../shared/time';
import { ArrowLeft, Captions, Check, ChevronRight, FilePlus2, Gauge, Pause, Palette, Play, Settings, Volume1, Volume2, VolumeX, type IconNode } from 'lucide';
import playerMarkup from './player.html?raw';
import playerStyles from './player.css?raw';

// Chrome exposes Document PiP at runtime, but the API is not present in every
// TypeScript DOM version or browser. Keep the local shape limited to what we use.
type DocumentPip = {
	requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
};
type PlayerSettings = {
	fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
	background?: 'off' | 'low' | 'medium' | 'high';
};
type PlayerMedia = HTMLElement & Pick<HTMLVideoElement, 'currentTime' | 'duration' | 'muted' | 'pause' | 'paused' | 'play' | 'playbackRate' | 'volume'>;
type SubtitlePreset = 'netflix' | 'cinema' | 'minimal' | 'contrast';
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const presets: SubtitlePreset[] = ['netflix', 'cinema', 'minimal', 'contrast'];
const svgNamespace = 'http://www.w3.org/2000/svg';

// Icons must be created by the PiP document. Adopting nodes created by the page
// document can behave inconsistently across the separate window boundary.
function lucide(document: Document, [tag, attributes, children]: IconNode): SVGElement {
	const element = document.createElementNS(svgNamespace, tag);
	for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
	element.append(...(children ?? []).map((child) => lucide(document, child)));
	return element;
}
const setIcon = (element: Element, icon: IconNode) => element.replaceChildren(lucide(element.ownerDocument, icon));

export async function openPlayer(
	video: PlayerMedia,
	settings: PlayerSettings = {},
	subtitleState: SubtitleState = { tracks: [] },
	sizeElement: HTMLElement = video
): Promise<void> {
	const api = (window as Window & { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
	if (!api) throw new Error('Document Picture-in-Picture is not supported by this browser.');
	const parent = video.parentNode;
	if (!parent) throw new Error('The selected video is no longer attached to this page.');

	// Relocation is the core product invariant: keep the real element so MSE/blob/
	// authenticated playback continues, then restore its exact DOM position and styling.
	const original = {
		parent,
		next: video.nextSibling,
		style: video.getAttribute('style'),
		className: video.className
	};
	const pip = await api.requestWindow({
		width: Math.max(480, sizeElement.clientWidth),
		height: Math.max(270, sizeElement.clientHeight)
	});
	let closed = false;
	let offset = 0;
	let raf = 0;
	let dragging = false;
	let wasPaused: boolean | undefined;
	let previousVolume = -1;
	// Reuse the session array by reference so imports and selection survive closing
	// and reopening PiP on this URL without persisting subtitle text to disk.
	const tracks = subtitleState.tracks;
	let activeTrack: SubtitleTrack | undefined;

	// Both pagehide and future cleanup paths may call restore; it must be idempotent.
	const restore = () => {
		if (closed) return;
		closed = true;
		cancelAnimationFrame(raf);
		// The original sibling may have disappeared while PiP was open. Appending to
		// the surviving parent is the safest fallback in that case.
		if (original.parent.isConnected) original.parent.insertBefore(video, original.next?.isConnected ? original.next : null);
		if (original.style === null) video.removeAttribute('style');
		else video.setAttribute('style', original.style);
		video.className = original.className;
	};
	pip.addEventListener('pagehide', restore, { once: true });

	// Translate durable preference names into CSS values owned by the PiP document.
	const fontSize = ({ small: '18px', medium: '24px', large: '30px', xlarge: '36px' } as const)[settings.fontSize ?? 'medium'];
	const alpha = ({ off: 0, low: 0.25, medium: 0.5, high: 0.75 } as const)[settings.background ?? 'medium'];
	pip.document.documentElement.style.setProperty('--subtitle-font-size', fontSize);
	pip.document.documentElement.style.setProperty('--subtitle-background-alpha', String(alpha));

	// Document PiP starts with an isolated empty document. Inject the trusted shell
	// and styles before moving the live video element into it.
	const style = pip.document.createElement('style');
	style.textContent = playerStyles;
	pip.document.head.append(style);
	const body = pip.document.body;
	const template = pip.document.createElement('template');
	template.innerHTML = playerMarkup;
	body.replaceChildren(template.content.cloneNode(true));
	// These selectors are an internal contract with player.html; absence is a build-time defect.
	const $ = <T extends Element>(selector: string) => body.querySelector(selector) as T;
	const player = $<HTMLElement>('#player'),
		subtitle = $<HTMLDivElement>('.subs'),
		play = $<HTMLButtonElement>('button.play'),
		progress = $<HTMLInputElement>('input.progress'),
		time = $<HTMLSpanElement>('.time'),
		mute = $<HTMLButtonElement>('button.mute'),
		volume = $<HTMLInputElement>('input.volume'),
		settingsButton = $<HTMLButtonElement>('button.settings'),
		settingsWrap = $<HTMLDivElement>('.settings-wrap'),
		menu = $<HTMLDivElement>('.settings-menu'),
		mainPage = $<HTMLDivElement>('.menu-main'),
		trackPage = $<HTMLDivElement>('.track-page'),
		speedPage = $<HTMLDivElement>('.speed-page'),
		trackPicker = $<HTMLButtonElement>('button.track-picker'),
		speedPicker = $<HTMLButtonElement>('button.speed-picker'),
		trackValue = $<HTMLSpanElement>('.track-value'),
		speedValue = $<HTMLSpanElement>('.speed-value'),
		trackOptions = $<HTMLDivElement>('.track-options'),
		speedOptions = $<HTMLDivElement>('.speed-options'),
		addSrt = $<HTMLButtonElement>('button.add-srt'),
		srtFile = $<HTMLInputElement>('input.srt-file'),
		styleIcon = $<HTMLSpanElement>('.style-icon'),
		trackIcon = $<HTMLSpanElement>('.track-icon'),
		addIcon = $<HTMLSpanElement>('.add-icon'),
		speedIcon = $<HTMLSpanElement>('.speed-icon');
	setIcon(play, Play);
	setIcon(mute, Volume2);
	setIcon(settingsButton, Settings);
	setIcon(styleIcon, Palette);
	setIcon(trackIcon, Captions);
	setIcon(addIcon, FilePlus2);
	setIcon(speedIcon, Gauge);
	for (const chevron of menu.querySelectorAll('.menu-chevron')) setIcon(chevron, ChevronRight);
	for (const back of menu.querySelectorAll('.back-icon')) setIcon(back, ArrowLeft);
	const pages = [mainPage, trackPage, speedPage];
	const showPage = (page: HTMLDivElement) => {
		for (const candidate of pages) candidate.hidden = candidate !== page;
	};
	const choiceButton = (label: string, selected: boolean, choose: () => void) => {
		const button = pip.document.createElement('button');
		button.className = 'choice-option';
		button.setAttribute('role', 'option');
		button.setAttribute('aria-selected', String(selected));
		const text = pip.document.createElement('span');
		text.className = 'choice-label';
		// Track names come from local files, so never interpolate them as HTML.
		text.textContent = label;
		const check = pip.document.createElement('span');
		check.className = 'choice-check';
		check.setAttribute('aria-hidden', 'true');
		setIcon(check, Check);
		button.append(text, check);
		button.addEventListener('click', choose);
		return button;
	};
	const refreshTracks = () => {
		trackValue.textContent = tracks[subtitleState.activeTrackIndex ?? -1]?.name ?? 'Off';
		trackOptions.replaceChildren(
			choiceButton('Off', subtitleState.activeTrackIndex === undefined, () => {
				selectTrack(-1);
				showPage(mainPage);
			}),
			...tracks.map((track, index) => {
				return choiceButton(track.name, subtitleState.activeTrackIndex === index, () => {
					selectTrack(index);
					showPage(mainPage);
				});
			})
		);
	};
	const choosePreset = (preset: SubtitlePreset) => {
		player.dataset.preset = preset;
		for (const button of menu.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.classList.toggle('active', button.dataset.preset === preset);
		// Presets are harmless global preferences and persist across sites.
		void chrome.storage.local.set({ subtitlePreset: preset });
	};
	const selectTrack = (index: number) => {
		const selected = tracks[index];
		subtitleState.activeTrackIndex = selected ? index : undefined;
		// Parse on selection rather than import so inactive tracks consume only raw text memory.
		activeTrack = selected ? parseSrt(selected.text) : undefined;
		refreshTracks();
	};
	const addTracks = (incoming: StoredSubtitle[]) => {
		// Avoid duplicate menu entries when the same file is imported again, then
		// activate the first incoming track.
		for (const track of incoming) if (!tracks.some((saved) => saved.name === track.name && saved.text === track.text)) tracks.push(track);
		selectTrack(tracks.findIndex((track) => track.name === incoming[0]?.name && track.text === incoming[0]?.text));
	};
	const refreshSpeeds = () => {
		speedValue.textContent = `${video.playbackRate}x`;
		speedOptions.replaceChildren(
			...speeds.map((rate) =>
				choiceButton(`${rate}x`, rate === video.playbackRate, () => {
					video.playbackRate = rate;
					refreshSpeeds();
					showPage(mainPage);
				})
			)
		);
	};
	refreshSpeeds();
	const seek = (amount: number) => {
		// Clamp keyboard seeks for both finite media and streams with unknown duration.
		video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + amount));
	};
	const setVolumeIcon = () => {
		const level = video.muted ? 0 : video.volume;
		if (level === previousVolume) return;
		previousVolume = level;
		setIcon(mute, level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2);
		mute.setAttribute('aria-label', level === 0 ? 'Unmute' : 'Mute');
	};

	// Media state may also change through the source page or native controls. A
	// single animation loop keeps controls and subtitles synchronized with all paths.
	const render = () => {
		if (closed) return;
		progress.max = String(Number.isFinite(video.duration) ? video.duration : 0);
		if (!dragging) progress.value = String(video.currentTime);
		progress.style.setProperty('--played', `${video.duration ? (video.currentTime / video.duration) * 100 : 0}%`);
		if (wasPaused !== video.paused) {
			wasPaused = video.paused;
			play.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
			setIcon(play, video.paused ? Play : Pause);
		}
		setVolumeIcon();
		volume.value = String(video.muted ? 0 : video.volume);
		time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
		// Positive offset looks ahead, so the matching subtitle appears earlier.
		// textContent is mandatory because SRT contents are untrusted local input.
		subtitle.textContent = activeTrack ? (findCue(activeTrack.cues, video.currentTime + offset)?.text ?? '') : '';
		raf = requestAnimationFrame(render);
	};

	// Move, do not clone, the page's real media element. Custom media hosts must
	// move as a whole so their HLS/MSE controller remains attached.
	video.setAttribute('style', 'display:block;width:100%;height:100%;object-fit:contain;background:#000');
	player.prepend(video);
	play.onclick = () => (video.paused ? void video.play() : video.pause());
	mute.addEventListener('click', () => {
		video.muted = !video.muted;
	});
	volume.addEventListener('input', () => {
		video.volume = Number(volume.value);
		video.muted = video.volume === 0;
	});
	const setMenuOpen = (open: boolean) => {
		// Always reset nested pages so reopening settings has a predictable entry point.
		showPage(mainPage);
		menu.classList.toggle('open', open);
		settingsButton.setAttribute('aria-expanded', String(open));
	};
	settingsButton.addEventListener('click', () => setMenuOpen(!menu.classList.contains('open')));
	pip.addEventListener('pointerdown', (event) => {
		if (!event.composedPath().includes(settingsWrap)) setMenuOpen(false);
	});
	menu
		.querySelectorAll<HTMLButtonElement>('[data-preset]')
		.forEach((button) => button.addEventListener('click', () => choosePreset(button.dataset.preset as SubtitlePreset)));
	trackPicker.addEventListener('click', () => showPage(trackPage));
	speedPicker.addEventListener('click', () => {
		refreshSpeeds();
		showPage(speedPage);
	});
	menu.querySelectorAll<HTMLButtonElement>('.choice-back').forEach((button) => button.addEventListener('click', () => showPage(mainPage)));
	addSrt.addEventListener('click', () => srtFile.click());
	srtFile.addEventListener('change', () => {
		// File reads are local-only. Filtering by extension avoids presenting unsupported formats.
		void Promise.all(
			[...(srtFile.files ?? [])].filter((file) => file.name.toLowerCase().endsWith('.srt')).map(async (file) => ({ name: file.name, text: await file.text() }))
		).then(addTracks);
	});
	progress.addEventListener('pointerdown', () => {
		dragging = true;
	});
	progress.addEventListener('input', () => {
		video.currentTime = Number(progress.value);
	});
	progress.addEventListener('pointerup', () => {
		dragging = false;
	});
	pip.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && menu.classList.contains('open')) {
			if (mainPage.hidden) showPage(mainPage);
			else {
				setMenuOpen(false);
				settingsButton.focus();
			}
			return;
		}
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
		// Centralize player shortcuts so each action reuses the same control behavior.
		const map: Record<string, () => void> = {
			' ': () => play.click(),
			ArrowLeft: () => seek(-5),
			ArrowRight: () => seek(5),
			j: () => seek(-10),
			l: () => seek(10),
			m: () => mute.click(),
			ArrowUp: () => {
				video.volume = Math.min(1, video.volume + 0.05);
			},
			ArrowDown: () => {
				video.volume = Math.max(0, video.volume - 0.05);
			},
			'[': () => {
				offset -= 0.5;
			},
			']': () => {
				offset += 0.5;
			}
		};
		const action = map[e.key.toLowerCase()] ?? map[e.key];
		if (action) {
			e.preventDefault();
			action();
		}
	});
	selectTrack(subtitleState.activeTrackIndex ?? -1);
	void chrome.storage.local.get({ subtitlePreset: 'netflix' as SubtitlePreset }).then((stored) => {
		const preset = stored.subtitlePreset as SubtitlePreset;
		// Storage is another runtime boundary, so reject stale/unknown preset values.
		choosePreset(presets.includes(preset) ? preset : 'netflix');
	});
	render();
}
