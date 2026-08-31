# Tasks

## Current

- [ ] Exercise the packaged extension against representative websites.

## Next

- [ ] Apply stored subtitle presentation settings to the PiP renderer.

## Backlog

- [ ] Add WebVTT parser.

## Completed

- [x] Resolve HLS from the selected video so unrelated player and advertising streams stay hidden.
- [x] Preserve source-page headers and cookies when playing protected HLS in the extension page.
- [x] Normalize responsive subtitle size and weight behavior across presets.
- [x] Restyle the PiP settings menu with compact YouTube-inspired rows and custom track/speed submenus.
- [x] Add dismissible player settings, responsive subtitle weight, and a subtitles-off track.
- [x] Extract the PiP player markup and styles from TypeScript template strings.
- [x] Implement Document PiP relocation, controls, SRT parsing, candidate scoring, and unit tests.
- [x] Keep SRT tracks and the active selection for the current page session, while storing subtitle presets globally.

## Known Bugs

- [ ] Some site-specific players may replace or require the original video DOM context.
