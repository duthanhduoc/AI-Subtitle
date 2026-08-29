import { describe, expect, it } from 'vitest';
import { parseSrt } from '../subtitles/srt';
import { findCue } from '../subtitles/search';

describe('SRT parsing', () => {
  it('handles BOM, CRLF, dot milliseconds, multiline and malformed blocks', () => {
    const track = parseSrt('\uFEFF1\r\n00:00:01,000 --> 00:00:04.5\r\nXin chào\r\nViệt Nam\r\n\r\nbad\nno time\n\n2\n00:00:05,000 --> 00:00:06,000\nNext');
    expect(track.cues).toEqual([{ id: '1', startTime: 1, endTime: 4.5, text: 'Xin chào\nViệt Nam' }, { id: '2', startTime: 5, endTime: 6, text: 'Next' }]);
  });
  it('finds cues at inclusive boundaries and gaps', () => { const cues = parseSrt('00:00:01,000 --> 00:00:02,000\nA\n\n00:00:04,000 --> 00:00:05,000\nB').cues; expect(findCue(cues, 1)?.text).toBe('A'); expect(findCue(cues, 2)?.text).toBe('A'); expect(findCue(cues, 3)).toBeUndefined(); expect(findCue(cues, 4)?.text).toBe('B'); });
});
