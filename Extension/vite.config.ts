import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  base: "./",
  // Popup and options are separate extension pages but share this Svelte build.
  build: {
    rollupOptions: {
      input: { popup: resolve("popup.html"), options: resolve("options.html") },
    },
  },
});
