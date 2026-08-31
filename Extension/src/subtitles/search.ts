import type { SubtitleCue } from './types';

// `parseSrt` sorts cues by start time, allowing every animation frame to locate
// the active cue in O(log n) instead of scanning a full movie's subtitles.
export function findCue(cues: SubtitleCue[], time: number): SubtitleCue | undefined {
	let low = 0;
	let high = cues.length - 1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const cue = cues[mid]!;
		// SRT boundaries are inclusive; a gap between cues intentionally returns nothing.
		if (time < cue.startTime) high = mid - 1;
		else if (time > cue.endTime) low = mid + 1;
		else return cue;
	}
	return undefined;
}
