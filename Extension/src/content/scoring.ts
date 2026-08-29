export type VideoMetrics = {
  width: number;
  height: number;
  visible: boolean;
  inViewport: boolean;
  playing: boolean;
  duration: number;
  readyState: number;
};

// Rank the video a user is most likely watching: meaningful size is required,
// then viewport presence, playback, duration and readiness provide strong hints.
export function scoreVideo(v: VideoMetrics): number {
  // Reject tracking pixels, thumbnails and hidden preloaded players.
  if (!v.visible || v.width < 120 || v.height < 70) return 0;
  // Cap area so extreme page layouts cannot outweigh every behavioral signal.
  const area = Math.min(v.width * v.height, 3840 * 2160) / 1000;
  return (
    area +
    (v.inViewport ? 1000 : 0) +
    (v.playing ? 500 : 0) +
    (v.duration >= 60 ? 250 : v.duration > 5 ? 50 : 0) +
    v.readyState * 5
  );
}
