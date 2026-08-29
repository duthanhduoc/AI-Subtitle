# AI Coding Agent Guide

## Purpose

Custom Document PiP is a local-only Chrome MV3 extension for existing HTML5 videos and SRT subtitles.

## Architecture

- `src/popup`: Svelte 5 popup; it only sends serializable messages.
- `src/content`: video discovery and the framework-free PiP orchestration.
- `src/pip`: Document PiP DOM UI and relocator lifecycle.
- `src/subtitles`: normalized cue types, SRT parser, and binary search.
- `src/background`: MV3 worker retained for extension entry completeness.

## Invariants

Do not create a replacement video from `src`; relocate the actual element and restore it idempotently. Subtitle file text is untrusted: never use `innerHTML`. PiP core must remain TypeScript/DOM code, not Svelte. Keep all processing local and do not add DRM bypass, ad blocking, tracking, or remote code.

## Workflow

Use Bun: `bun install`, then `bun run check`, `bun test`, and `bun run build`. Build output is `dist/`. Update relevant docs and `TASKS.md` for meaningful work. Keep runtime message validation at boundaries and use strict TypeScript without `any`.

## Code comments

When generating or changing code, add concise English comments for business rules, invariants, lifecycle/cleanup behavior, security boundaries, non-obvious algorithms, and important tradeoffs. Explain why the code exists or what must remain true; do not narrate obvious syntax, assignments, imports, or every line. Keep comments accurate when behavior changes, and remove comments that have become stale.

## Caution

`src/pip/player.ts` owns relocation and cleanup. `public/manifest.json` must match produced files. See `docs/` for lifecycle, decisions, testing, product scope, and limitations.
