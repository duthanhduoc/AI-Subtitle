import { expect, it } from 'vitest';
import { scoreVideo } from '../content/scoring';
const base = { visible: true, inViewport: true, playing: true, duration: 120, readyState: 4 };
it('prioritizes a large meaningful video deterministically', () => { expect(scoreVideo({ ...base, width: 1280, height: 720 })).toBeGreaterThan(scoreVideo({ ...base, width: 320, height: 180 })); expect(scoreVideo({ ...base, width: 1280, height: 720 })).toBeGreaterThan(scoreVideo({ ...base, visible: false, width: 1920, height: 1080 })); });
