import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	base: './',
	// Popup, trang tùy chọn và HLS player là các trang extension riêng biệt.
	build: {
		rollupOptions: {
			input: {
				popup: resolve('popup.html'),
				options: resolve('options.html'),
				player: resolve('player.html')
			}
		}
	}
});
