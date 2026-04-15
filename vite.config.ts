import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
  },
  css: {
    // Inline empty PostCSS config to prevent inheriting the parent
    // project's postcss.config.js (which uses Tailwind v3).
    // Tailwind v4 is handled by the @tailwindcss/vite plugin above.
    postcss: {
      plugins: [],
    },
  },
});

