<script lang="ts">
  import type { Candidate, HlsUrl, Message, Reply } from "../shared/messages";
  import { formatTime } from "../shared/time";

  // Popup state is disposable. Imported tracks that must survive reopening PiP
  // are owned by the content script's page session instead.
  let candidates = $state<Candidate[]>([]);
  let selected = $state("");
  let subtitle = $state<string | undefined>();
  let subtitleName = $state<string | undefined>();
  let offset = $state(0);
  let status = $state("Scanning this tab…");
  let busy = $state(false);
  let hlsUrls = $state<HlsUrl[]>([]);

  async function tabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) throw new Error("No active tab.");
    return tab.id;
  }
  async function scanHls() {
    const id = await tabId();
    const reply = (await chrome.runtime.sendMessage({
      type: "GET_HLS_URLS",
      tabId: id,
    })) as Reply<HlsUrl[]>;
    if (reply.ok) hlsUrls = reply.value;
  }
  // There is no persistent content-script declaration in the manifest. Inject
  // before each request; the content bundle's window guard makes this idempotent.
  async function ask<T>(message: Message): Promise<Reply<T>> {
    const id = await tabId();
    await chrome.scripting
      .executeScript({ target: { tabId: id }, files: ["content.js"] })
      .catch(() => undefined);
    return chrome.tabs.sendMessage(id, message) as Promise<Reply<T>>;
  }
  // Highest-scoring candidate is the default, but expose all viable videos when
  // pages contain more than one real player.
  async function scan() {
    busy = true;
    status = "Scanning this tab…";
    try {
      await scanHls();
      const reply = await ask<Candidate[]>({ type: "GET_CANDIDATES" });
      if (!reply.ok) throw new Error(reply.error);
      candidates = reply.value;
      selected = candidates[0]?.id ?? "";
      status = candidates.length
        ? ""
        : "No usable HTML5 video found on this page.";
    } catch (error) {
      status =
        error instanceof Error ? error.message : "Could not scan this page.";
    } finally {
      busy = false;
    }
  }
  function playHls(entry: HlsUrl) {
    const url = `${chrome.runtime.getURL("player.html")}?src=${encodeURIComponent(entry.url)}`;
    void chrome.tabs.create({ url });
  }
  async function openHlsDialog(entry: HlsUrl) {
    const reply = await ask<null>({
      type: "OPEN_DIALOG",
      url: entry.url,
      id: selected || undefined,
      subtitles: subtitle,
      subtitleName,
    });
    if (!reply.ok) status = reply.error;
  }
  async function openSelectedDialog() {
    // HLS playback is more reliable than a site's blob-backed <video>. Prefer
    // the manifest when one was observed for this tab, even if a video candidate
    // is also present. Mux loads its video-only rendition playlists after its
    // master playlist; opening a rendition drops the separate audio track.
    const hls =
      hlsUrls.find(({ url }) =>
        /^https:\/\/stream\.mux\.com\/[^/?]+\.m3u8(?:$|[?#])/i.test(url),
      ) ??
      hlsUrls.find(({ url }) =>
        /\/(?:index|master)\.m3u8(?:$|[?#])/i.test(url),
      ) ?? hlsUrls[0];
    if (hls) {
      await openHlsDialog(hls);
      return;
    }
    if (!selected) {
      status = "No reusable video URL or HLS stream found on this page.";
      return;
    }
    const reply = await ask<null>({
      type: "OPEN_DIALOG",
      id: selected,
      subtitles: subtitle,
      subtitleName,
    });
    if (!reply.ok) status = reply.error;
  }
  // File contents stay local and cross to the page only as serializable text.
  async function chooseSubtitle(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".srt")) {
      status = "Choose an .srt subtitle file.";
      return;
    }
    subtitle = await file.text();
    subtitleName = file.name;
    status = `Loaded ${file.name} locally.`;
  }
  async function open() {
    if (!selected) return;
    busy = true;
    try {
      const reply = await ask<null>({
        type: "OPEN_PIP",
        id: selected,
        subtitles: subtitle,
        subtitleName,
      });
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
  // Positive offset looks ahead in media time, making subtitles appear earlier.
  async function changeOffset(amount: number) {
    offset = Math.round((offset + amount) * 10) / 10;
    await ask<null>({ type: "SET_OFFSET", offset });
  }

  // Scan immediately because opening the popup is the user's discovery action.
  scan();
</script>

<main>
  <h1>Custom PiP</h1>
  {#if candidates.length > 1}
    <label>
      Choose video
      <select bind:value={selected}>
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
  <button
    onclick={openSelectedDialog}
    disabled={(!selected && !hlsUrls.length) || busy}
  >
    Create video dialog
  </button>
  <label>
    Subtitle (.srt)
    <input type="file" accept=".srt,text/plain" onchange={chooseSubtitle} />
  </label>
  <div class="offset">
    <span>Subtitle offset: {offset.toFixed(1)}s</span>
    <button onclick={() => changeOffset(-0.5)}>−0.5</button>
    <button onclick={() => changeOffset(0.5)}>+0.5</button>
  </div>
  <button onclick={scan} disabled={busy}>Rescan</button>
  {#if hlsUrls.length}
    <section class="hls">
      <h2>Detected HLS streams</h2>
      {#each hlsUrls as entry (entry.url)}
        <div class="stream">
          <code title={entry.url}>{entry.url}</code>
          <div class="stream-actions">
            <button class="play-hls" onclick={() => openHlsDialog(entry)}>
              Dialog
            </button>
            <button onclick={() => playHls(entry)}>Tab</button>
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
  select,
  input {
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
  .offset {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .offset span {
    flex-basis: 100%;
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
    overflow: hidden;
    padding: 6px;
    border-radius: 4px;
    background: #f1f5f9;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .play-hls {
    background: #16a34a;
    color: white;
  }
  .stream-actions {
    display: flex;
    gap: 6px;
  }
  a {
    display: block;
    margin-top: 14px;
    color: #2563eb;
  }
</style>
