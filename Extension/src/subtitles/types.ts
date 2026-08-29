export interface SubtitleCue {
  id?: string;
  startTime: number;
  endTime: number;
  text: string;
}
export interface SubtitleTrack {
  cues: SubtitleCue[];
}
// Keep raw imported text in the page session. Tracks are parsed only when
// selected, and no subtitle content is uploaded or written to extension storage.
export interface StoredSubtitle {
  name: string;
  text: string;
}
export interface SubtitleState {
  // This object is shared across PiP reopenings for the current page URL.
  tracks: StoredSubtitle[];
  activeTrackIndex?: number;
}
