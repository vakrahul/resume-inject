import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5174,
    strictPort: true,
    // Dev proxy — routes /api and /files to the local Express server
    proxy: {
      "/api": "http://127.0.0.1:3010",
      "/files": "http://127.0.0.1:3010",
    },
  },
});
