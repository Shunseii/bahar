import path from "node:path";
import { lingui } from "@lingui/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",

    rollupOptions: {
      external: ["workbox-window"],
      output: {
        // Keep sync-wasm in its own chunk. It self-spawns a worker via
        // `new Worker(import.meta.url, { type: "module" })`; if its code is
        // inlined into the app entry, `import.meta.url` resolves to that entry
        // and the worker loads the app bootstrap (top-level `document` access)
        // in a DOM-less worker scope -> "document is not defined". Isolating it
        // makes the worker load only sync-wasm's own module.
        manualChunks: (id) =>
          id.includes("@tursodatabase/sync-wasm") ? "sync-wasm" : undefined,
      },
    },

    sourcemap: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@uidotdev/usehooks"],
    esbuildOptions: {
      target: "es2022",
    },
  },
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MB
      },
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
      project: "bahar-web",
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
    dedupe: ["react", "react-dom"],
  },
});
