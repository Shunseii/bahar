import { expect, test } from "@playwright/test";

const CONSENT_DISMISS_BUTTON = /no thanks/i;
const DICTIONARY_HEADING = /your dictionary/i;
const LOGIN_URL = /\/login/;

// Smoke test proving the headless-auth storageState (minted in global-setup)
// lands the browser in an authenticated session. BAH-113 builds the real
// happy-path suite on top of this.
test("loads the app as an authenticated user", async ({ page }) => {
  await page.goto("/");

  const dismissConsent = page.getByRole("button", {
    name: CONSENT_DISMISS_BUTTON,
  });
  const dictionaryHeading = page.getByRole("heading", {
    name: DICTIONARY_HEADING,
  });

  // A user who hasn't answered the newsletter prompt gets a "Stay updated?"
  // modal on top of the app; while open it makes the rest of the page inert,
  // hiding the dictionary heading from the accessibility tree. Wait for
  // whichever renders first (no fixed penalty either way) and dismiss the modal
  // only if it actually appeared. (Deterministic handling of this consent state
  // belongs to the seeding ticket.) The timeout covers first-load local DB
  // (sync-wasm) init.
  await expect(dismissConsent.or(dictionaryHeading).first()).toBeVisible({
    timeout: 15_000,
  });
  if (await dismissConsent.isVisible()) {
    await dismissConsent.click();
  }

  // The authenticated dictionary landing renders a "Your Dictionary" <h1>;
  // an unauthenticated session would instead be redirected to /login.
  await expect(dictionaryHeading).toBeVisible();

  // Sanity: we were not bounced to the login route.
  await expect(page).not.toHaveURL(LOGIN_URL);
});
