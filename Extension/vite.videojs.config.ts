import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/content/videojs-main.ts",
      formats: ["iife"],
      name: "VideoJsMain",
      fileName: () => "videojs-main.js",
    },
    outDir: "dist",
  },
});
