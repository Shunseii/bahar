import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "./src"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          exclude: ["**/node_modules/**", "**/*.browser.test.ts"],
        },
      },
      {
        resolve: { alias },
        server: {
          headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
          },
        },
        optimizeDeps: {
          entries: ["src/**/*.browser.test.ts"],
          esbuildOptions: { target: "es2022" },
        },
        test: {
          name: "browser",
          include: ["**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
