<script lang="ts">
  import type { Candidate, Message, Reply } from "../shared/messages";
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

  async function tabId(): Promise<number> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) throw new Error("No active tab.");
    return tab.id;
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
  a {
    display: block;
    margin-top: 14px;
    color: #2563eb;
  }
</style>
