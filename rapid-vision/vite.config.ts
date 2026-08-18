import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Config próprio do projeto — sem dependência de @lovable.dev/vite-tanstack-config.
// SPA estática: sem SSR, sem Nitro, sem runtime de servidor.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
