# Custom Document PiP

A local-first Manifest V3 Chrome extension that moves a selected HTML5 video into a custom Document Picture-in-Picture window and renders local SRT subtitles.

## Features

- Scores visible videos (including open Shadow DOM) and lets you choose when needed.
- Reuses the existing video element, avoiding a second stream whenever the site allows it.
- Custom, non-dimming PiP controls; seeking, volume, playback speed, and keyboard controls.
- Detects HLS `.m3u8` playlists from the tab and opens playable streams in an extension-owned player page.
- Local UTF-8 SRT parsing and safe `textContent` subtitle rendering.
- No network requests, analytics, accounts, or subtitle upload.

## Install and run

```sh
bun install
bun run build
```

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `dist/`.

Use the extension button on a tab with an HTML5 video, select a candidate if required, optionally choose a `.srt`, and open PiP. Positive subtitle offset means the cue is selected at `video.currentTime + offset`, so subtitles appear earlier.

Keyboard shortcuts in PiP: Space play/pause; Left/Right ±5s; J/L ±10s; M mute; Up/Down volume; `[`/`]` subtitle offset.

## Development

`bun run dev`, `bun run check`, `bun run lint`, `bun test`, and `bun run build` are the project checks. See [AGENTS.md](AGENTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/TESTING.md](docs/TESTING.md).

## Limitations

Document PiP requires current desktop Chrome. DRM, cross-origin frames, closed Shadow DOM, and players tightly coupled to their original DOM may fail safely. No DRM bypass, ad blocking, cloud storage, or legacy subtitle-encoding conversion is attempted.

## Screenshots

Screenshots will be added once the extension is exercised in Chrome.
