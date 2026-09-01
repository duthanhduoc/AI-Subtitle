import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		// Đây là lần build cuối nên phải giữ mọi artifact đã tạo trước đó.
		emptyOutDir: false,
		// Manifest V3 nạp background service worker dưới dạng ES module.
		lib: {
			entry: 'src/background/service-worker.ts',
			formats: ['es'],
			fileName: () => 'service-worker.js'
		},
		outDir: 'dist'
	}
});
