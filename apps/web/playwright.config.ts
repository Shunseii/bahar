import { defineConfig, devices } from "@playwright/test";
import { resolveE2eConfig, STORAGE_STATE_PATH } from "./e2e/lib/mint.mjs";

const { webBaseUrl } = resolveE2eConfig();

// The backend (API at E2E_API_BASE_URL + its central DB) must be running before
// the suite starts — global-setup mints a session against it. See e2e/README.md.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",
  // Serial for now: all tests share one test user + one DB (see e2e/README.md).
  // The data-seeding ticket re-enables parallelism once it adds per-test/worker
  // isolation.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webBaseUrl,
    storageState: STORAGE_STATE_PATH,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: webBaseUrl,
    reuseExistingServer: !process.env.CI,
  },
});
