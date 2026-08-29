# Development

Run `bun install`, then `bun run dev` for UI development or `bun run build` for loadable `dist/`. Use Chrome DevTools for the popup, page content script, and the PiP window separately. To add a message, update `src/shared/messages.ts`, validate it in the content handler, then update UI callers. A setting belongs in the options UI and `chrome.storage.local`; a parser should produce `SubtitleTrack` without changing the player.
