import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // This is the final build pass, so it must preserve all earlier artifacts.
    emptyOutDir: false,
    // Manifest V3 loads the background service worker as an ES module.
    lib: {
      entry: "src/background/service-worker.ts",
      formats: ["es"],
      fileName: () => "service-worker.js",
    },
    outDir: "dist",
  },
});
