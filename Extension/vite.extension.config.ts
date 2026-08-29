import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Preserve the popup/options output produced by the first Vite build.
    emptyOutDir: false,
    // A single IIFE can be injected directly into arbitrary tabs by Chrome.
    lib: {
      entry: "src/content/index.ts",
      formats: ["iife"],
      name: "CustomPipContent",
      fileName: () => "content.js",
    },
    outDir: "dist",
  },
});
