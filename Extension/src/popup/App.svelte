<script lang="ts">
  import type {
    Candidate,
    HlsUrl,
    Message,
    PlayerCommand,
    PlayerMessage,
    Reply,
  } from "../shared/messages";
  import {
    findMarkedVideoHlsUrls,
    selectPrimaryHls,
  } from "../shared/hls";
  import { formatTime } from "../shared/time";

  // Popup state is disposable. Imported tracks that must survive reopening PiP
  // are owned by the content script's page session instead.
  let candidates = $state<Candidate[]>([]);
  let selected = $state("");
  let status = $state("Scanning this tab…");
  let busy = $state(false);
  let hlsUrls = $state<HlsUrl[]>([]);
  let copiedUrl = $state("");
  let resolutions = $state<Record<string, string>>({});
  let resolutionScan = 0;
  let playerTabId: number | undefined;
  let sourceTabId: number | undefined;
  let primaryHlsUrls = $derived(selectPrimaryHls(hlsUrls, resolutions));

  async function activeTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) throw new Error("No active tab.");
    return tab;
  }
  async function scanHls(tabId: number, candidateId?: string) {
    const reply = (await chrome.runtime.sendMessage({
      type: "GET_HLS_URLS",
      tabId,
    })) as Reply<HlsUrl[]>;
    if (!reply.ok) throw new Error(reply.error);
    const attachedUrls = candidateId
      ? await hlsForCandidate(tabId, candidateId)
      : [];
    hlsUrls = attachedUrls.length
      ? attachedUrls.map((url) => ({ url, frameId: 0, seenAt: Date.now() }))
      : reply.value;
    resolutions = {};
    const scanId = ++resolutionScan;
    void Promise.all(
      hlsUrls.map(async ({ url }) => {
        const resolution = await readHlsResolution(url);
        if (scanId === resolutionScan) resolutions[url] = resolution;
      }),
    );
  }

  async function hlsForCandidate(tabId: number, id: string) {
    const marker = crypto.randomUUID();
    const marked = await ask<null>(
      { type: "MARK_HLS_TARGET", id, marker },
      tabId,
    );
    if (!marked.ok) return [];
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: findMarkedVideoHlsUrls,
      args: [marker],
    });
    return injection?.result ?? [];
  }

  async function readHlsResolution(url: string): Promise<string> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return "Unknown";
      const manifest = await response.text();
      const values = [...manifest.matchAll(/RESOLUTION=(\d+)x(\d+)/gi)].map(
        ([, width, height]) => `${width}×${height}`,
      );
      return [...new Set(values)].join(", ") || "Unknown";
    } catch {
      return "Unknown";
    }
  }
  // There is no persistent content-script declaration in the manifest. Inject
  // before each request; the content bundle's window guard makes this idempotent.
  async function ask<T>(message: Message, tabId?: number): Promise<Reply<T>> {
    tabId ??= (await activeTab()).id!;
    await chrome.scripting
      .executeScript({ target: { tabId }, files: ["content.js"] })
      .catch(() => undefined);
    return chrome.tabs.sendMessage(tabId, message) as Promise<Reply<T>>;
  }
  function askPlayer<T>(
    message: PlayerCommand,
    tabId: number,
  ): Promise<Reply<T>> {
    const playerMessage: PlayerMessage = { ...message, tabId };
    return chrome.runtime.sendMessage(playerMessage) as Promise<Reply<T>>;
  }
  // Highest-scoring candidate is the default, but expose all viable videos when
  // pages contain more than one real player.
  async function scan() {
    busy = true;
    status = "Scanning this tab…";
    try {
      const tab = await activeTab();
      const tabId = tab.id!;
      sourceTabId = tabId;
      playerTabId = undefined;
      if (tab.url?.startsWith(chrome.runtime.getURL("player.html"))) {
        playerTabId = tabId;
        const reply = await askPlayer<Candidate[]>(
          { type: "GET_CANDIDATES" },
          tabId,
        );
        if (!reply.ok) throw new Error(reply.error);
        candidates = reply.value;
        selected = candidates[0]?.id ?? "";
        await scanHls(tabId, selected || undefined);
        status = candidates.length
          ? ""
          : "The player video is not ready. Rescan and try again.";
        return;
      }
      if (tab.url?.startsWith(chrome.runtime.getURL(""))) {
        candidates = [];
        selected = "";
        await scanHls(tabId);
        status = hlsUrls.length
          ? ""
          : "No HLS stream found in this extension page.";
        return;
      }
      const reply = await ask<Candidate[]>({ type: "GET_CANDIDATES" }, tabId);
      if (!reply.ok) throw new Error(reply.error);
      candidates = reply.value;
      selected = candidates[0]?.id ?? "";
      await scanHls(tabId, selected || undefined);
      status =
        candidates.length || hlsUrls.length
          ? ""
          : "No usable HTML5 video or HLS stream found on this page.";
    } catch (error) {
      status =
        error instanceof Error ? error.message : "Could not scan this page.";
    } finally {
      busy = false;
    }
  }
  async function chooseVideo(event: Event) {
    selected = (event.currentTarget as HTMLSelectElement).value;
    if (!sourceTabId) return;
    busy = true;
    try {
      await scanHls(sourceTabId, selected);
      status = "";
    } catch (error) {
      status =
        error instanceof Error ? error.message : "Could not scan this video.";
    } finally {
      busy = false;
    }
  }
  async function playHls(entry: HlsUrl) {
    const currentTab = await activeTab();
    const url = `${chrome.runtime.getURL("player.html")}?src=${encodeURIComponent(entry.url)}`;
    void chrome.tabs.create({
      url,
      index: currentTab.index + 1,
    });
  }

  async function copyHls(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      copiedUrl = url;
      setTimeout(() => {
        if (copiedUrl === url) copiedUrl = "";
      }, 1500);
    } catch {
      status = "Could not copy the HLS URL.";
    }
  }

  async function open() {
    if (!selected) return;
    busy = true;
    try {
      const message: Message = { type: "OPEN_PIP", id: selected };
      const reply = playerTabId
        ? await askPlayer<null>(message, playerTabId)
        : await ask<null>(message);
      if (!reply.ok) throw new Error(reply.error);
      status = "Picture-in-Picture opened.";
    } catch (error) {
      status =
        error instanceof Error
          ? error.message
          : "Could not open Picture-in-Picture.";
    } finally {
      busy = false;
    }
  }
  // Scan immediately because opening the popup is the user's discovery action.
  scan();
</script>

<main>
  <h1>Custom PiP</h1>
  {#if candidates.length > 1}
    <label>
      Choose video
      <select value={selected} onchange={chooseVideo}>
        {#each candidates as candidate (candidate.id)}
          <option value={candidate.id}>
            {candidate.width}×{candidate.height} · {candidate.playing
              ? "Playing"
              : "Paused"} · {formatTime(candidate.duration)}
          </option>
        {/each}
      </select>
    </label>
  {:else if candidates[0]}
    {@const candidate = candidates[0]}
    <p>
      {candidate.width}×{candidate.height} · {candidate.playing
        ? "Playing"
        : "Paused"} · {formatTime(candidate.duration)}
    </p>
  {/if}
  <button class="primary" onclick={open} disabled={!selected || busy}>
    Open Picture-in-Picture
  </button>
  <button onclick={scan} disabled={busy}>Rescan</button>
  {#if hlsUrls.length}
    <section class="hls">
      <h2>Detected HLS streams</h2>
      {#each primaryHlsUrls as entry (entry.url)}
        <div class="stream">
          <div class="stream-resolution">
            {resolutions[entry.url] ?? "Loading…"}
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
            <button class="play-hls" onclick={() => playHls(entry)}>Play</button
            >
            <button
              class="copy-hls"
              onclick={() => copyHls(entry.url)}
              aria-label="Copy HLS URL"
              >{copiedUrl === entry.url ? "Copied" : "Copy"}</button
            >
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
    width: 100%;
    background: #2563eb;
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
