import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the build works unchanged at a domain root, on a
  // GitHub Pages project path (/hiddenwar/), or opened from the filesystem.
  // There is no client-side router, so nothing depends on an absolute base.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@game": fileURLToPath(new URL("./src/game", import.meta.url)),
      "@ui": fileURLToPath(new URL("./src/components", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
