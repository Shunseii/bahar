import path from "path";
import react from "@vitejs/plugin-react-swc";
import { lingui } from "@lingui/vite-plugin";
import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";

export default defineConfig({
  build: {
    outDir: "dist",
  },
  plugins: [
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    lingui(),
    TanStackRouterVite(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
