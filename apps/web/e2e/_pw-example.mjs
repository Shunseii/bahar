// Example agent browser driver.
//
// Standalone script (no Playwright test runner) that an agent can run to drive
// the app as a logged-in user:  `node e2e/_pw-example.mjs`
//
// Reuses the SAME headless-auth session as the e2e suite: it loads the
// storageState written by mint.mjs, regenerating it on the fly if it's missing.
// Copy this file to `_pw-<task>.mjs` and replace the "drive the app" section.

import { access } from "node:fs/promises";
import { chromium } from "playwright";
import {
  resolveE2eConfig,
  STORAGE_STATE_PATH,
  writeStorageState,
} from "./lib/mint.mjs";

const ensureStorageState = async (config) => {
  try {
    await access(STORAGE_STATE_PATH);
  } catch {
    console.log("[pw] no storageState found, minting a fresh session...");
    await writeStorageState(config);
  }
};

const main = async () => {
  const config = resolveE2eConfig();
  await ensureStorageState(config);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH,
  });
  const page = await context.newPage();

  // --- drive the app (logged in) --------------------------------------------
  await page.goto(config.webBaseUrl);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/.auth/example.png", fullPage: true });
  console.log(`[pw] loaded ${config.webBaseUrl} as ${config.email}`);
  // --------------------------------------------------------------------------

  await context.close();
  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
