import type { SubtitleCue } from './types';

// `parseSrt` sắp xếp cue theo thời gian bắt đầu, giúp mỗi animation frame tìm
// cue đang active trong O(log n) thay vì quét phụ đề của cả bộ phim.
export function findCue(cues: SubtitleCue[], time: number): SubtitleCue | undefined {
	let low = 0;
	let high = cues.length - 1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const cue = cues[mid]!;
		// Biên SRT là inclusive; khoảng trống giữa các cue cố ý trả về không có kết quả.
		if (time < cue.startTime) high = mid - 1;
		else if (time > cue.endTime) low = mid + 1;
		else return cue;
	}
	return undefined;
}
