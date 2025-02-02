import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import { lingui } from "@lingui/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import { ValidateEnv } from "@julr/vite-plugin-validate-env";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  build: {
    outDir: "dist",

    rollupOptions: {
      external: ["workbox-window"],
    },

    sourcemap: true,
  },
  plugins: [
    ValidateEnv(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Bahar",
        short_name: "Bahar",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
    sentryVitePlugin({
      org: "bahar-app",
      project: "typescript-react",
      telemetry: false,
      reactComponentAnnotation: {
        enabled: true,
      },
    }),
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
