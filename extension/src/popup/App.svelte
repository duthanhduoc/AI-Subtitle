<script lang="ts">
	import type { Candidate, HlsUrl, Message, PlayerCommand, PlayerMessage, Reply } from '../shared/messages';
	import { findMarkedVideoHlsUrls, firstHlsVariant, formatHlsResolutions, parseHlsDuration, selectPrimaryHls } from '../shared/hls';
	import { formatTime } from '../shared/time';

	type HlsMetadata = { resolution: string; duration: string; fetchedAt: number };
	type DirectCandidate = Candidate & { source: string };
	const HLS_METADATA_KEY = 'hlsMetadata';
	const PLAYBACK_REFERRER_RULE_ID = 2001;

	const isDirectMediaSource = (source?: string): source is string => {
		if (!source) return false;
		try {
			const url = new URL(source);
			return (url.protocol === 'http:' || url.protocol === 'https:') && !/\.(m3u8|mpd)(?:$|[?#])/i.test(url.href);
		} catch {
			return false;
		}
	};

	// State của popup chỉ tồn tại trong lần mở hiện tại; metadata HLS đắt hơn được cache riêng.
	let candidates = $state<Candidate[]>([]);
	let status = $state('Scanning this tab…');
	let busy = $state(false);
	let hlsUrls = $state<HlsUrl[]>([]);
	let copiedUrl = $state('');
	let resolutions = $state<Record<string, string>>({});
	let durations = $state<Record<string, string>>({});
	let resolutionScan = 0;
	let primaryHlsUrls = $derived(selectPrimaryHls(hlsUrls));
	const isDirectCandidate = (candidate: Candidate): candidate is DirectCandidate => isDirectMediaSource(candidate.source);
	// Nhiều video element trỏ cùng URL vẫn chỉ là một nguồn MP4 trong danh sách.
	let mp4Sources = $derived.by(() => [...new Map(candidates.filter(isDirectCandidate).map((candidate) => [candidate.source, candidate])).values()]);

	async function activeTab(): Promise<chrome.tabs.Tab> {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true
		});
		if (!tab?.id) throw new Error('No active tab.');
		return tab;
	}
	async function frameIds(tabId: number): Promise<number[]> {
		try {
			return ((await chrome.webNavigation.getAllFrames({ tabId })) ?? []).map(({ frameId }) => frameId);
		} catch {
			return [0];
		}
	}
	async function candidatesInTab(tabId: number): Promise<Candidate[]> {
		const replies = await Promise.all(
			(await frameIds(tabId)).map(async (frameId) => {
				try {
					const reply = await ask<Candidate[]>({ type: 'GET_CANDIDATES' }, tabId, frameId);
					return reply.ok ? reply.value.map((candidate) => ({ ...candidate, frameId })) : [];
				} catch {
					return [];
				}
			})
		);
		return replies.flat();
	}
	async function scanHls(tabId: number, candidate?: Candidate) {
		const reply = (await chrome.runtime.sendMessage({
			type: 'GET_HLS_URLS',
			tabId
		})) as Reply<HlsUrl[]>;
		if (!reply.ok) throw new Error(reply.error);
		const attachedUrls = candidate ? await hlsForCandidate(tabId, candidate) : [];
		hlsUrls = attachedUrls.length ? attachedUrls.map((url) => ({ url, frameId: 0, seenAt: Date.now() })) : reply.value;
		resolutions = {};
		durations = {};
		const scanId = ++resolutionScan;
		const metadata = await loadHlsMetadata();
		const results = await Promise.all(
			hlsUrls.map(async ({ url }) => {
				const cached = metadata[url];
				if (cached && Date.now() - cached.fetchedAt < metadataTtl(cached)) return { url, ...cached };
				const [resolution, duration] = await Promise.all([readHlsResolution(url), readHlsDuration(url)]);
				return { url, resolution, duration, fetchedAt: Date.now() };
			})
		);
		if (scanId !== resolutionScan) return;
		for (const { url, resolution, duration, fetchedAt } of results) {
			resolutions[url] = resolution;
			durations[url] = duration;
			metadata[url] = { resolution, duration, fetchedAt };
		}
		await chrome.storage.local.set({ [HLS_METADATA_KEY]: metadata });
	}
	async function loadHlsMetadata(): Promise<Record<string, HlsMetadata>> {
		const stored = await chrome.storage.local.get(HLS_METADATA_KEY);
		return (stored[HLS_METADATA_KEY] as Record<string, HlsMetadata> | undefined) ?? {};
	}
	const metadataTtl = (metadata: HlsMetadata) =>
		metadata.resolution === 'Unknown' || metadata.duration === 'Unknown' || metadata.duration === 'Live' ? 5 * 60_000 : 24 * 60 * 60_000;

	async function hlsForCandidate(tabId: number, candidate: Candidate) {
		const marker = crypto.randomUUID();
		const marked = await ask<null>({ type: 'MARK_HLS_TARGET', id: candidate.id, marker }, tabId, candidate.frameId);
		if (!marked.ok) return [];
		const [injection] = await chrome.scripting.executeScript({
			target: { tabId, frameIds: [candidate.frameId] },
			world: 'MAIN',
			func: findMarkedVideoHlsUrls,
			args: [marker]
		});
		return injection?.result ?? [];
	}

	async function readHlsResolution(url: string): Promise<string> {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
			if (!response.ok) return 'Unknown';
			const manifest = await response.text();
			const values = [...manifest.matchAll(/RESOLUTION=(\d+)x(\d+)/gi)].map(([, width, height]) => `${width}×${height}`);
			return [...new Set(values)].join(', ') || 'Unknown';
		} catch {
			return 'Unknown';
		}
	}
	async function readHlsDuration(url: string, depth = 0): Promise<string> {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
			if (!response.ok) return 'Unknown';
			const manifest = await response.text();
			const duration = parseHlsDuration(manifest);
			if (typeof duration === 'number') return formatTime(duration);
			if (duration === 'Live') return duration;
			if (depth >= 1) return 'Unknown';
			const variant = firstHlsVariant(manifest, url);
			return variant ? readHlsDuration(variant, depth + 1) : 'Unknown';
		} catch {
			return 'Unknown';
		}
	}
	// Manifest nạp content script tự động, nhưng tab đã mở trước khi extension reload
	// có thể chưa có bundle mới. Lần inject dự phòng an toàn nhờ guard trên `window`.
	async function ask<T>(message: Message, tabId?: number, frameId?: number): Promise<Reply<T>> {
		tabId ??= (await activeTab()).id!;
		await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId ?? 0] }, files: ['content.js'] }).catch(() => undefined);
		if (frameId === undefined) return chrome.tabs.sendMessage(tabId, message) as Promise<Reply<T>>;
		return chrome.tabs.sendMessage(tabId, message, { frameId }) as Promise<Reply<T>>;
	}
	function askPlayer<T>(message: PlayerCommand, tabId: number): Promise<Reply<T>> {
		const playerMessage: PlayerMessage = { ...message, tabId };
		return chrome.runtime.sendMessage(playerMessage) as Promise<Reply<T>>;
	}
	// Candidate có điểm cao nhất được dùng để gắn HLS; mọi URL MP4 duy nhất vẫn được hiển thị.
	async function scan() {
		busy = true;
		status = 'Scanning this tab…';
		try {
			const tab = await activeTab();
			const tabId = tab.id!;
			if (tab.url?.startsWith(chrome.runtime.getURL('player.html'))) {
				const reply = await askPlayer<Candidate[]>({ type: 'GET_CANDIDATES' }, tabId);
				if (!reply.ok) throw new Error(reply.error);
				candidates = reply.value;
				await scanHls(tabId, candidates[0]);
				status = candidates.length ? '' : 'The player video is not ready. Rescan and try again.';
				return;
			}
			if (tab.url?.startsWith(chrome.runtime.getURL(''))) {
				candidates = [];
				await scanHls(tabId);
				status = hlsUrls.length ? '' : 'No HLS stream found in this extension page.';
				return;
			}
			candidates = await candidatesInTab(tabId);
			await scanHls(tabId, candidates[0]);
			status = candidates.length || hlsUrls.length ? '' : 'No usable HTML5 video or HLS stream found on this page.';
		} catch (error) {
			status = error instanceof Error ? error.message : 'Could not scan this page.';
		} finally {
			busy = false;
		}
	}
	async function playSource(source: string) {
		const currentTab = await activeTab();
		if (!currentTab.url || !/^https?:\/\//i.test(currentTab.url)) {
			status = 'The current page cannot be used as a media referrer.';
			return;
		}
		const mediaHost = new URL(source).hostname;
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: [PLAYBACK_REFERRER_RULE_ID],
			addRules: [
				{
					id: PLAYBACK_REFERRER_RULE_ID,
					priority: 10,
					action: {
						type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
						requestHeaders: [{ header: 'Referer', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: currentTab.url }]
					},
					condition: {
						urlFilter: `||${mediaHost}/`,
						resourceTypes: [
							chrome.declarativeNetRequest.ResourceType.MEDIA,
							chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
							chrome.declarativeNetRequest.ResourceType.OTHER
						]
					}
				}
			]
		});
		const url = `${chrome.runtime.getURL('player.html')}?src=${encodeURIComponent(source)}`;
		void chrome.tabs.create({
			url,
			index: currentTab.index + 1
		});
	}

	async function copyUrl(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copiedUrl = url;
			setTimeout(() => {
				if (copiedUrl === url) copiedUrl = '';
			}, 2000);
		} catch {
			status = 'Could not copy the media URL.';
		}
	}

	// Quét ngay vì việc mở popup chính là thao tác người dùng yêu cầu phát hiện.
	scan();
</script>

{#snippet sourceRow(url: string, duration: string, resolution: string)}
	<article class="source">
		<div class="source-metadata">{duration} <span aria-hidden="true">|</span> {resolution}</div>
		<div class="source-actions">
			<div class="source-url" title={url}>
				<code aria-label={url}>
					{#if url.length > 40}
						<span class="url-start">{url.slice(0, 20)}</span>
						<span class="url-ellipsis" aria-hidden="true">...</span>
						<span class="url-end">{url.slice(-20)}</span>
					{:else}
						{url}
					{/if}
				</code>
				<button
					class="copy-source"
					type="button"
					title={copiedUrl === url ? 'Copied' : 'Copy URL'}
					aria-label={copiedUrl === url ? 'Copied' : 'Copy full URL'}
					aria-live="polite"
					onclick={() => copyUrl(url)}
				>
					{#if copiedUrl === url}
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg
						>
					{/if}
				</button>
			</div>
			<button class="play-source" onclick={() => playSource(url)} disabled={busy}>Play</button>
		</div>
	</article>
{/snippet}

<main>
	<h1>Available sources</h1>
	<nav class="toolbar" aria-label="Popup actions">
		<button onclick={scan} disabled={busy}>Rescan</button>
		<a class="settings" href="options.html" target="_blank">Settings</a>
	</nav>

	{#if primaryHlsUrls.length}
		<section>
			<h2>HLS</h2>
			{#each primaryHlsUrls as entry (entry.url)}
				{@render sourceRow(entry.url, durations[entry.url] ?? 'Loading…', formatHlsResolutions(resolutions[entry.url] ?? 'Loading…'))}
			{/each}
		</section>
	{/if}

	{#if mp4Sources.length}
		<section>
			<h2>MP4</h2>
			{#each mp4Sources as entry (entry.source)}
				{@render sourceRow(
					entry.source,
					Number.isFinite(entry.duration) ? formatTime(entry.duration) : 'Unknown',
					entry.videoHeight ? `${entry.videoHeight}p` : 'Unknown'
				)}
			{/each}
		</section>
	{/if}

	{#if status}<p class="status">{status}</p>{/if}
</main>

<style>
	main {
		box-sizing: border-box;
		width: 380px;
		padding: 16px;
		font: 14px system-ui;
		color: #0f172a;
	}
	h1 {
		margin: 0 0 12px;
		font-size: 20px;
	}
	button {
		padding: 8px;
		border: 0;
		border-radius: 6px;
		background: #e2e8f0;
		color: #0f172a;
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.toolbar {
		display: flex;
		gap: 8px;
	}
	.settings {
		padding: 8px;
		border-radius: 6px;
		background: #e2e8f0;
		color: #0f172a;
		text-decoration: none;
	}
	section {
		margin-top: 16px;
	}
	h2 {
		margin: 0;
		font-size: 16px;
	}
	.source {
		display: grid;
		gap: 7px;
		padding: 12px 0;
	}
	.source + .source {
		border-top: 1px solid #cbd5e1;
	}
	.source-metadata {
		font-weight: 650;
	}
	.source-actions {
		display: flex;
		gap: 8px;
	}
	.source-url {
		position: relative;
		display: flex;
		flex: 1;
		align-items: center;
		min-width: 0;
		border-radius: 6px;
		background: #f1f5f9;
	}
	code {
		display: flex;
		flex: 1;
		align-items: center;
		min-width: 0;
		overflow: hidden;
		padding: 7px;
		font-size: 10px;
		white-space: nowrap;
	}
	.url-start {
		min-width: 0;
		overflow: hidden;
	}
	.url-ellipsis,
	.url-end {
		flex: none;
	}
	.url-ellipsis {
		margin: 0 3px;
		font-size: 1.5em;
		font-weight: 800;
		letter-spacing: 2px;
	}
	.copy-source {
		position: absolute;
		top: 50%;
		right: 3px;
		display: grid;
		place-items: center;
		padding: 5px;
		background: #cbd5e1;
		opacity: 0;
		transform: translateY(-50%);
		transition: opacity 120ms ease;
	}
	.source-url:hover .copy-source,
	.source-url:focus-within .copy-source {
		opacity: 1;
	}
	.copy-source svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}
	.play-source {
		flex: none;
		min-width: 64px;
		background: #16a34a;
		color: white;
	}
	.status {
		margin-bottom: 0;
		color: #475569;
	}
</style>
