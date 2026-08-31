import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	base: './',
	// Popup, options and the HLS player are separate extension pages.
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
