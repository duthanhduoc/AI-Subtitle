# Decisions

## ADR-001: Document PiP

**Decision:** use Document Picture-in-Picture, not native video PiP. **Why:** it permits custom controls and subtitle UI without Chrome's native hover overlay. **Consequence:** current Chrome is required.

## ADR-002: Vanilla player core

**Decision:** keep relocation/player logic in DOM TypeScript. **Why:** HTMLVideoElement lifecycle belongs to the page and PiP documents; this avoids framework coupling. Svelte is only popup/options UI.

## ADR-003: Move existing video

**Decision:** relocate the video rather than cloning its source. **Why:** blob/MSE/authenticated streams often cannot be recreated. **Consequence:** sites dependent on surrounding DOM may not work.

## ADR-004: Normalize subtitles

**Decision:** SRT parses to `SubtitleCue[]`. **Why:** future parsers can feed the same renderer and search layer.

## ADR-005: Local only

**Decision:** no backend or telemetry. **Why:** subtitle files and viewing behavior stay on-device.
