import { stripPngWrappedMpegTs } from '../player-page/image-fragment-loader';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0]);

test('strips a PNG wrapper only when aligned MPEG-TS packets follow it', () => {
	const ts = new Uint8Array(188 * 3);
	ts[0] = ts[188] = ts[376] = 0x47;
	const wrapped = new Uint8Array(png.length + 5 + ts.length);
	wrapped.set(png);
	wrapped.set(ts, png.length + 5);

	expect(new Uint8Array(stripPngWrappedMpegTs(wrapped.buffer))).toEqual(ts);
	expect(stripPngWrappedMpegTs(png.buffer)).toBe(png.buffer);
	expect(stripPngWrappedMpegTs(ts.buffer)).toBe(ts.buffer);
});
