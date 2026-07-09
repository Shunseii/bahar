import { expect, type Page, test } from "@playwright/test";

const CONSENT_DISMISS_BUTTON = /no thanks/i;
const DICTIONARY_HEADING = /your dictionary/i;
const LOGIN_URL = /\/login/;

/**
 * Loads the app in `page` and asserts it reaches the authenticated dictionary,
 * dismissing the newsletter consent modal if it appears. Same flow as
 * auth.spec.ts, factored out so both tabs are checked identically. The timeout
 * covers first-load local DB (sync-wasm/OPFS) init.
 */
const expectAuthedDictionary = async (page: Page) => {
  await page.goto("/");

  const dismissConsent = page.getByRole("button", {
    name: CONSENT_DISMISS_BUTTON,
  });
  const dictionaryHeading = page.getByRole("heading", {
    name: DICTIONARY_HEADING,
  });

  await expect(dismissConsent.or(dictionaryHeading).first()).toBeVisible({
    timeout: 15_000,
  });
  if (await dismissConsent.isVisible()) {
    await dismissConsent.click();
  }

  await expect(dictionaryHeading).toBeVisible();
  await expect(page).not.toHaveURL(LOGIN_URL);
};

/**
 * Regression for BAH-139. OPFS grants one exclusive SyncAccessHandle per file
 * browser-wide (not per-tab), so with the DB owned in-tab, a second tab's
 * `@tursodatabase/sync-wasm` connect fails with an opfs_lock_error and its
 * dictionary never loads. Moving DB ownership into a SharedWorker (one shared
 * connection across tabs) fixes it.
 *
 * Both pages open in the SAME browser context, so they share origin storage
 * (the OPFS file) and the SharedWorker — the exact multi-tab condition that
 * breaks today. Two separate contexts would each get isolated storage and
 * would NOT reproduce the bug.
 */
test("opens in a second tab without hitting the OPFS lock", async ({
  page,
  context,
}) => {
  // Tab A: initialize the local DB (dictionary heading == DB is up).
  await expectAuthedDictionary(page);

  // Tab B in the same context contends for the same OPFS file.
  const secondTab = await context.newPage();
  await expectAuthedDictionary(secondTab);
});
