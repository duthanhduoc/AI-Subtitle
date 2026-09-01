<script lang="ts">
	import type { Candidate, HlsUrl, Message, PlayerCommand, PlayerMessage, Reply } from '../shared/messages';
	import { findMarkedVideoHlsUrls, firstHlsVariant, parseHlsDuration, selectPrimaryHls } from '../shared/hls';
	import { formatTime } from '../shared/time';

	type HlsMetadata = { resolution: string; duration: string; fetchedAt: number };
	const HLS_METADATA_KEY = 'hlsMetadata';

	const isDirectMediaSource = (source?: string): source is string => {
		if (!source) return false;
		try {
			const url = new URL(source);
			return (url.protocol === 'http:' || url.protocol === 'https:') && !/\.(m3u8|mpd)(?:$|[?#])/i.test(url.href);
		} catch {
			return false;
		}
	};

	// State của popup là tạm thời. Track đã import cần tồn tại qua lần mở lại PiP
	// được sở hữu bởi page session của content script.
	let candidates = $state<Candidate[]>([]);
	let selected = $state('');
	let status = $state('Scanning this tab…');
	let busy = $state(false);
	let hlsUrls = $state<HlsUrl[]>([]);
	let copiedUrl = $state('');
	let resolutions = $state<Record<string, string>>({});
	let durations = $state<Record<string, string>>({});
	let resolutionScan = 0;
	let playerTabId: number | undefined;
	let sourceTabId: number | undefined;
	let primaryHlsUrls = $derived(selectPrimaryHls(hlsUrls));
	const candidateKey = (candidate: Candidate) => `${candidate.frameId}:${candidate.id}`;
	let selectedCandidate = $derived(candidates.find((candidate) => candidateKey(candidate) === selected));
	let canPlaySelected = $derived(isDirectMediaSource(selectedCandidate?.source));

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
	// Candidate có điểm cao nhất là mặc định, nhưng hiển thị mọi video dùng được khi
	// trang có nhiều hơn một player thật.
	async function scan() {
		busy = true;
		status = 'Scanning this tab…';
		try {
			const tab = await activeTab();
			const tabId = tab.id!;
			sourceTabId = tabId;
			playerTabId = undefined;
			if (tab.url?.startsWith(chrome.runtime.getURL('player.html'))) {
				playerTabId = tabId;
				const reply = await askPlayer<Candidate[]>({ type: 'GET_CANDIDATES' }, tabId);
				if (!reply.ok) throw new Error(reply.error);
				candidates = reply.value;
				selected = candidates[0] ? candidateKey(candidates[0]) : '';
				await scanHls(tabId, candidates[0]);
				status = candidates.length ? '' : 'The player video is not ready. Rescan and try again.';
				return;
			}
			if (tab.url?.startsWith(chrome.runtime.getURL(''))) {
				candidates = [];
				selected = '';
				await scanHls(tabId);
				status = hlsUrls.length ? '' : 'No HLS stream found in this extension page.';
				return;
			}
			candidates = await candidatesInTab(tabId);
			selected = candidates[0] ? candidateKey(candidates[0]) : '';
			await scanHls(tabId, candidates[0]);
			status = candidates.length || hlsUrls.length ? '' : 'No usable HTML5 video or HLS stream found on this page.';
		} catch (error) {
			status = error instanceof Error ? error.message : 'Could not scan this page.';
		} finally {
			busy = false;
		}
	}
	async function chooseVideo(event: Event) {
		selected = (event.currentTarget as HTMLSelectElement).value;
		if (!sourceTabId) return;
		busy = true;
		try {
			await scanHls(sourceTabId, selectedCandidate);
			status = '';
		} catch (error) {
			status = error instanceof Error ? error.message : 'Could not scan this video.';
		} finally {
			busy = false;
		}
	}
	async function playHls(entry: HlsUrl) {
		const currentTab = await activeTab();
		const url = `${chrome.runtime.getURL('player.html')}?src=${encodeURIComponent(entry.url)}`;
		void chrome.tabs.create({
			url,
			index: currentTab.index + 1
		});
	}
	async function playSelected() {
		const source = selectedCandidate?.source;
		if (!isDirectMediaSource(source)) {
			status = 'The selected video has no direct media URL.';
			return;
		}
		const currentTab = await activeTab();
		const url = `${chrome.runtime.getURL('player.html')}?src=${encodeURIComponent(source)}`;
		void chrome.tabs.create({
			url,
			index: currentTab.index + 1
		});
	}

	async function copyHls(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copiedUrl = url;
			setTimeout(() => {
				if (copiedUrl === url) copiedUrl = '';
			}, 1500);
		} catch {
			status = 'Could not copy the HLS URL.';
		}
	}

	async function open() {
		if (!selected) return;
		busy = true;
		try {
			if (!selectedCandidate) return;
			const message: Message = { type: 'OPEN_PIP', id: selectedCandidate.id };
			const reply = playerTabId ? await askPlayer<null>(message, playerTabId) : await ask<null>(message, sourceTabId, selectedCandidate.frameId);
			if (!reply.ok) throw new Error(reply.error);
			status = 'Picture-in-Picture opened.';
		} catch (error) {
			status = error instanceof Error ? error.message : 'Could not open Picture-in-Picture.';
		} finally {
			busy = false;
		}
	}
	// Quét ngay vì việc mở popup chính là thao tác người dùng yêu cầu phát hiện.
	scan();
</script>

<main>
	<h1>Custom PiP</h1>
	{#if candidates.length > 1}
		<label>
			Choose video
			<select value={selected} onchange={chooseVideo}>
				{#each candidates as candidate (candidateKey(candidate))}
					<option value={candidateKey(candidate)}>
						{candidate.width}×{candidate.height} · {candidate.playing ? 'Playing' : 'Paused'} · {formatTime(candidate.duration)}
					</option>
				{/each}
			</select>
		</label>
	{:else if candidates[0]}
		{@const candidate = candidates[0]}
		<p>
			{candidate.width}×{candidate.height} · {candidate.playing ? 'Playing' : 'Paused'} · {formatTime(candidate.duration)}
		</p>
	{/if}
	<div class="primary-actions">
		<button class="primary" onclick={open} disabled={!selected || busy}>Picture-in-Picture</button>
		<button class="play-video" onclick={playSelected} disabled={!canPlaySelected || busy}>Play</button>
	</div>
	<button onclick={scan} disabled={busy}>Rescan</button>
	{#if hlsUrls.length}
		<section class="hls">
			<h2>Detected HLS streams</h2>
			{#each primaryHlsUrls as entry (entry.url)}
				<div class="stream">
					<div class="stream-resolution">
						{resolutions[entry.url] ?? 'Loading…'} · {durations[entry.url] ?? 'Loading…'}
					</div>
					<code title={entry.url} aria-label={entry.url}>
						{#if entry.url.length > 48}
							<span class="url-start">{entry.url.slice(0, -24)}</span>
							<span class="url-ellipsis" aria-hidden="true">...</span>
							<span class="url-end">{entry.url.slice(-24)}</span>
						{:else}
							{entry.url}
						{/if}
					</code>
					<div class="stream-actions">
						<button class="play-hls" onclick={() => playHls(entry)}>Play</button>
						<button class="copy-hls" onclick={() => copyHls(entry.url)} aria-label="Copy HLS URL">{copiedUrl === entry.url ? 'Copied' : 'Copy'}</button>
					</div>
				</div>
			{/each}
		</section>
	{/if}
	{#if status}<p class="status">{status}</p>{/if}
	<a href="options.html" target="_blank">Settings</a>
</main>

<style>
	main {
		width: 320px;
		padding: 16px;
		font: 14px system-ui;
		color: #0f172a;
	}
	h1 {
		margin: 0 0 14px;
		font-size: 20px;
	}
	label {
		display: grid;
		gap: 6px;
		margin: 14px 0;
	}
	select {
		max-width: 100%;
	}
	button {
		padding: 8px;
		border: 0;
		border-radius: 6px;
		background: #e2e8f0;
		color: #0f172a;
		cursor: pointer;
	}
	.primary {
		background: #2563eb;
		color: white;
	}
	.primary-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.primary-actions button {
		min-width: 0;
	}
	.play-video {
		background: #16a34a;
		color: white;
	}
	.status {
		color: #475569;
	}
	.hls {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid #cbd5e1;
	}
	h2 {
		margin: 0 0 8px;
		font-size: 14px;
	}
	.stream {
		display: grid;
		gap: 6px;
		margin-top: 10px;
	}
	code {
		display: flex;
		align-items: center;
		overflow: hidden;
		padding: 6px;
		border-radius: 4px;
		background: #f1f5f9;
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.url-start {
		min-width: 0;
		overflow: hidden;
	}
	.url-ellipsis {
		flex: none;
		margin: 0 3px;
		padding: 0 4px 2px;
		border-radius: 3px;
		background: #cbd5e1;
		color: #334155;
		font-weight: 800;
	}
	.url-end {
		flex: none;
	}
	.stream-resolution {
		color: #0f766e;
		font-weight: 700;
	}
	.play-hls {
		background: #16a34a;
		color: white;
	}
	.stream-actions {
		display: flex;
		gap: 6px;
	}
	.stream-actions button {
		flex: 1;
	}
	a {
		display: block;
		margin-top: 14px;
		color: #2563eb;
	}
</style>
