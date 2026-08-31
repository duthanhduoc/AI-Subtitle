import type { SubtitleState } from '../subtitles/types';

export type SubtitleSession = SubtitleState & { url: string };

// Reopening PiP on the same page keeps imported tracks. A URL change (including
// SPA navigation) is a new viewing session and must not leak the previous media's subtitles.
export const sessionForUrl = (session: SubtitleSession, url: string): SubtitleSession => (session.url === url ? session : { url, tracks: [] });
