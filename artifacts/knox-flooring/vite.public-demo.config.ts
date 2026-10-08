import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { copyFile, writeFile } from "node:fs/promises";

const sampleOutput = path.resolve(import.meta.dirname, "dist/public-sample");

export default defineConfig({
  base: "/", root: import.meta.dirname,
  publicDir: false,
  plugins: [react(), tailwindcss(), {
    name: "public-sample-assets-only",
    async closeBundle() {
      await copyFile(path.resolve(import.meta.dirname, "public/catalyst-official.png"), path.join(sampleOutput, "catalyst-official.png"));
      await writeFile(path.join(sampleOutput, "robots.txt"), "User-agent: *\nDisallow: /\n");
    },
  }],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") }, dedupe: ["react", "react-dom"] },
  build: {
    outDir: sampleOutput,
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(import.meta.dirname, "public-demo.html") },
  },
});
