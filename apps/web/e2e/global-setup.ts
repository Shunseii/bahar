import type { FullConfig } from "@playwright/test";
// mint.mjs is plain ESM shared with the _pw-*.mjs agent drivers; types come
// from the sibling mint.d.ts.
import { resolveE2eConfig, writeStorageState } from "./lib/mint.mjs";

/**
 * Playwright global setup: mints a real session cookie once before the suite
 * runs and writes it to the storageState file that `use.storageState` loads.
 */
const globalSetup = async (_config: FullConfig): Promise<void> => {
  const config = resolveE2eConfig();
  const path = await writeStorageState(config);

  console.log(`[e2e] minted session for ${config.email} -> ${path}`);
};

export default globalSetup;
