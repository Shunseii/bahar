// Headless session minting for e2e tests and agent browser drivers.
//
// Logs a user in WITHOUT a human: no OAuth redirect, no email inbox. The flow
// is entirely server-side against the running API:
//
//   1. POST /api/auth/email-otp/send-verification-otp  (type: "sign-in")
//   2. Read the plaintext OTP straight from the central `verifications` table
//      (better-auth stores it unhashed by default; see readOtp below).
//   3. POST /api/auth/sign-in/email-otp  ->  grab the Set-Cookie session cookie.
//
// The resulting cookies are written as a Playwright storageState file that both
// `playwright.config.ts` (via global-setup) and the `_pw-*.mjs` agent drivers
// load, so a login happens once and is reused everywhere.
//
// Kept as plain ESM (not .ts) so the .mjs agent drivers can import it directly
// with no build step. Types live alongside in `mint.d.ts`.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@tursodatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));

/** Path of the Playwright storageState file this module reads/writes. */
export const STORAGE_STATE_PATH = resolve(here, "../.auth/state.json");

// better-auth 1.4.19 stores the sign-in OTP in `verifications` keyed by this
// identifier prefix, with value "<otp>:<attempts>" (plaintext — storeOTP is not
// overridden in apps/api/src/auth.ts). Coupled to better-auth internals; a major
// upgrade could change it. See BAH-156 for the test-mode-capture alternative.
const OTP_IDENTIFIER_PREFIX = "sign-in-otp-";

/**
 * Resolves harness config from env with local-dev defaults. The defaults mirror
 * apps/web/.env (VITE_API_BASE_URL), apps/api/.env (DATABASE_URL) and the vite
 * dev server port.
 */
export const resolveE2eConfig = () => ({
  apiBaseUrl: process.env.E2E_API_BASE_URL ?? "https://local.bahar.dev",
  webBaseUrl: process.env.E2E_WEB_BASE_URL ?? "http://localhost:5173",
  centralDbUrl: process.env.E2E_CENTRAL_DB_URL ?? "http://localhost:8080",
  centralDbToken: process.env.E2E_CENTRAL_DB_TOKEN || undefined,
  email: process.env.E2E_TEST_EMAIL ?? "e2e@bahar.test",
});

const sendOtp = async ({ apiBaseUrl, email }) => {
  const response = await fetch(
    `${apiBaseUrl}/api/auth/email-otp/send-verification-otp`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `send-verification-otp failed: ${response.status} ${await response.text()}`
    );
  }
};

const readOtp = async ({ centralDbUrl, centralDbToken, email }) => {
  const connection = connect({ url: centralDbUrl, authToken: centralDbToken });

  try {
    const { rows } = await connection.execute(
      "SELECT value FROM verifications WHERE identifier = ? ORDER BY created_at DESC LIMIT 1",
      [`${OTP_IDENTIFIER_PREFIX}${email}`]
    );

    const [row] = rows;

    if (!row) {
      throw new Error(
        `No OTP found in verifications for ${email}. Is the API pointed at the same central DB (${centralDbUrl})?`
      );
    }

    // value is "<otp>:<attempts>"
    return String(row.value).split(":")[0];
  } finally {
    await connection.close();
  }
};

const signIn = async ({ apiBaseUrl, email, otp }) => {
  const response = await fetch(`${apiBaseUrl}/api/auth/sign-in/email-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });

  if (!response.ok) {
    throw new Error(
      `sign-in/email-otp failed: ${response.status} ${await response.text()}`
    );
  }

  const setCookieHeaders = response.headers.getSetCookie();

  if (setCookieHeaders.length === 0) {
    throw new Error("sign-in/email-otp returned no Set-Cookie header");
  }

  return setCookieHeaders;
};

const toPlaywrightSameSite = (raw) => {
  switch (raw?.toLowerCase()) {
    case "none":
      return "None";
    case "strict":
      return "Strict";
    default:
      return "Lax";
  }
};

const parseSetCookie = ({ header, fallbackDomain, fallbackSecure }) => {
  const [pair, ...rawAttributes] = header.split(";").map((part) => part.trim());
  const separator = pair.indexOf("=");
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);

  const attributes = new Map();
  for (const attribute of rawAttributes) {
    const separatorIndex = attribute.indexOf("=");
    if (separatorIndex === -1) {
      attributes.set(attribute.toLowerCase(), "");
    } else {
      attributes.set(
        attribute.slice(0, separatorIndex).toLowerCase(),
        attribute.slice(separatorIndex + 1)
      );
    }
  }

  const maxAge = attributes.get("max-age");
  const expires =
    maxAge === undefined
      ? -1
      : Math.floor(Date.now() / 1000) + Number.parseInt(maxAge, 10);

  return {
    name,
    value,
    domain: attributes.get("domain") ?? fallbackDomain,
    path: attributes.get("path") ?? "/",
    expires,
    httpOnly: attributes.has("httponly"),
    secure: attributes.has("secure") || fallbackSecure,
    sameSite: toPlaywrightSameSite(attributes.get("samesite")),
  };
};

/**
 * Runs the full headless sign-in flow and returns a Playwright storageState
 * object. Does not touch the filesystem — see `writeStorageState`.
 */
export const mintSession = async (config = resolveE2eConfig()) => {
  const { apiBaseUrl, centralDbUrl, centralDbToken } = config;
  const email = config.email.toLowerCase();

  await sendOtp({ apiBaseUrl, email });
  const otp = await readOtp({ centralDbUrl, centralDbToken, email });
  const setCookieHeaders = await signIn({ apiBaseUrl, email, otp });

  const apiUrl = new URL(apiBaseUrl);
  const cookies = setCookieHeaders.map((header) =>
    parseSetCookie({
      header,
      fallbackDomain: apiUrl.hostname,
      fallbackSecure: apiUrl.protocol === "https:",
    })
  );

  return { cookies, origins: [] };
};

/**
 * Mints a session and writes it to `STORAGE_STATE_PATH`, creating the parent
 * directory if needed. Returns the path written.
 */
export const writeStorageState = async (config = resolveE2eConfig()) => {
  const storageState = await mintSession(config);
  await mkdir(dirname(STORAGE_STATE_PATH), { recursive: true });
  await writeFile(
    STORAGE_STATE_PATH,
    `${JSON.stringify(storageState, null, 2)}\n`
  );
  return STORAGE_STATE_PATH;
};

// Allow `node e2e/lib/mint.mjs` (wired as the `e2e:auth` script) to regenerate
// the storageState on demand, independent of a Playwright run.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeStorageState()
    .then((path) => {
      console.log(`Wrote storageState to ${path}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
