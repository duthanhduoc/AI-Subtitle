import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		// Giữ output popup/options do lần build Vite đầu tiên tạo ra.
		emptyOutDir: false,
		// Một IIFE duy nhất có thể được Chrome inject trực tiếp vào tab bất kỳ.
		lib: {
			entry: 'src/content/index.ts',
			formats: ['iife'],
			name: 'CustomPipContent',
			fileName: () => 'content.js'
		},
		outDir: 'dist'
	}
});
