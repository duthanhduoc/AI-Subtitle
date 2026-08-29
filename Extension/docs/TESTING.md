# Testing

Run `bun test`, `bun run check`, and `bun run build`.

Manual checks: open a normal HTML5 video, open and close PiP and confirm continuous playback/restoration; open Settings in the PiP toolbar, switch every subtitle preset, add multiple multilingual/multiline SRT files, switch tracks, close/reopen PiP on the same URL and confirm the tracks remain selectable; verify a preset remains selected on a different website; seek and adjust offset; test multiple video selection; resize PiP; try an SPA navigation and confirm no page corruption. Fullscreen follows Chrome/site behavior and is not coordinated by v1.
