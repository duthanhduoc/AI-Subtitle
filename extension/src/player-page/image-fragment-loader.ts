import type { FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderStats } from 'hls.js';

// Segment ngụy trang bắt đầu bằng một PNG hợp lệ, còn MPEG-TS dùng packet cố định 188 byte.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const TS_PACKET_SIZE = 188;

export function stripPngWrappedMpegTs(data: ArrayBuffer): ArrayBuffer {
	const bytes = new Uint8Array(data);
	// Fast path: các segment bình thường không bắt đầu bằng PNG thì giữ nguyên tuyệt đối.
	if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return data;

	const view = new DataView(data);
	let offset = PNG_SIGNATURE.length;
	while (offset + 12 <= bytes.length) {
		const chunkLength = view.getUint32(offset);
		const chunkEnd = offset + 12 + chunkLength;
		// Chunk lỗi hoặc bị cắt không được xem là payload ngụy trang.
		if (chunkEnd > bytes.length) return data;

		const isIend = bytes[offset + 4] === 0x49 && bytes[offset + 5] === 0x45 && bytes[offset + 6] === 0x4e && bytes[offset + 7] === 0x44;
		if (isIend) {
			// Sau IEND có thể có padding tùy CDN. Tìm điểm bắt đầu TS thay vì cố định offset.
			for (let start = chunkEnd; start + TS_PACKET_SIZE * 2 < bytes.length; start++) {
				// Cần ba sync byte liên tiếp đúng nhịp 188 để tránh cắt nhầm dữ liệu ảnh.
				if (bytes[start] === 0x47 && bytes[start + TS_PACKET_SIZE] === 0x47 && bytes[start + TS_PACKET_SIZE * 2] === 0x47) {
					return data.slice(start);
				}
			}
			// PNG hợp lệ nhưng không có TS nối sau đó: không biến đổi response.
			return data;
		}
		offset = chunkEnd;
	}

	return data;
}

export class ImageFragmentLoader implements Loader<FragmentLoaderContext> {
	private readonly loader: Loader<FragmentLoaderContext>;

	constructor(config: HlsConfig) {
		// Chỉ thay fLoader của fragment; loader playlist/manifest và key vẫn là loader gốc.
		this.loader = new config.loader(config) as Loader<FragmentLoaderContext>;
	}

	get context(): FragmentLoaderContext | null {
		return this.loader.context;
	}

	get stats(): LoaderStats {
		return this.loader.stats;
	}

	load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<FragmentLoaderContext>): void {
		const transform = (data: string | ArrayBuffer) => (data instanceof ArrayBuffer ? stripPngWrappedMpegTs(data) : data);
		// Transform cả success lẫn progress để không đẩy phần PNG vào transmuxer ở bất kỳ đường nào.
		this.loader.load(context, config, {
			...callbacks,
			onProgress: callbacks.onProgress
				? (stats, callbackContext, data, networkDetails) => callbacks.onProgress!(stats, callbackContext, transform(data), networkDetails)
				: undefined,
			onSuccess: (response, stats, callbackContext, networkDetails) =>
				callbacks.onSuccess(
					{ ...response, data: response.data instanceof ArrayBuffer ? transform(response.data) : response.data },
					stats,
					callbackContext,
					networkDetails
				)
		});
	}

	abort(): void {
		this.loader.abort();
	}

	destroy(): void {
		this.loader.destroy();
	}

	getCacheAge(): number | null {
		return this.loader.getCacheAge?.() ?? null;
	}

	getResponseHeader(name: string): string | null {
		return this.loader.getResponseHeader?.(name) ?? null;
	}
}
