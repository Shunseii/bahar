# e2e / headless auth

Playwright e2e harness. The key piece is **headless auth**: it logs a user in
with no human, no OAuth redirect, and no email inbox, so tests and agents can
drive the app as an authenticated user.

## How auth works

Production auth is GitHub/Apple OAuth + email OTP via Resend — neither is
automatable. Instead, `e2e/lib/mint.mjs` mints a real session server-side:

1. `POST /api/auth/email-otp/send-verification-otp` (`type: "sign-in"`).
2. Reads the plaintext OTP straight from the central `verifications` table
   (better-auth stores it unhashed by default).
3. `POST /api/auth/sign-in/email-otp` → captures the `Set-Cookie` session cookie.

The cookies are written to `e2e/.auth/state.json` (gitignored) as a Playwright
`storageState`. `playwright.config.ts` loads it via `use.storageState`, and the
`_pw-*.mjs` agent drivers load the same file — so login happens once and is
reused everywhere.

> The OTP read couples the harness to a better-auth internal format
> (`sign-in-otp-<email>` identifier, `<otp>:<attempts>` value). A better-auth
> major could change it; see BAH-156 for the test-mode-capture alternative.

## Test user & data

A **single** fixed test user (`E2E_TEST_EMAIL`, default `e2e@bahar.test`) is
shared across the whole Playwright suite **and** agent runs. Deliberate: one
stable user means one provisioned Turso DB created once and reused, so dev runs
don't accumulate real cloud DBs (see `createNewUserDb` in
`apps/api/src/clients/turso.ts`, which hits the Turso Platform API regardless of
`NODE_ENV`). No cleanup script needed.

Because the user and its DB are shared, scenario data must be **reset to a known
baseline**, not just appended — tracked in the separate e2e data-seeding ticket.
Things that ticket owns:

- **Shared mutable state** — a test that writes pollutes later tests and the
  next run; seeding must truncate + load fixtures, not add.
- **Parallelism** — currently forced serial (`fullyParallel: false`, `workers: 1`)
  because concurrent tests would race on the shared data. Re-enable parallelism
  there once per-test / per-worker isolation exists.
- **Sync layering** — the web local DB (sync-wasm/OPFS) is a separate copy synced
  from the remote user DB on a ~60s cycle, so seeding the remote isn't instantly
  visible. Decide remote-seed + force-sync vs. seeding the browser's local DB
  directly (overlaps BAH-139, multi-tab OPFS).

## Prerequisites

The **backend must be running** — global-setup mints against it:

```bash
make local-db        # central DB (verifications table) on :8080
make tunnel          # exposes the API at https://local.bahar.dev
pnpm run dev         # API + web
```

The web dev server is started automatically by Playwright
(`reuseExistingServer` locally).

On a fresh clone, install the Chromium binary once:

```bash
pnpm --filter web test:e2e:install   # playwright install chromium
```

## Running

```bash
pnpm --filter web test:e2e        # run the suite (mints session first)
pnpm --filter web test:e2e:ui     # Playwright UI mode
pnpm --filter web e2e:auth        # (re)mint storageState only
pnpm --filter web type-check:e2e  # type-check the harness (e2e/tsconfig.json)
node apps/web/e2e/_pw-example.mjs # example agent browser driver
```

The e2e sources live outside the app's `tsc` scope (`apps/web/tsconfig.json`
only includes `src`), so they have their own `e2e/tsconfig.json`
(Node + `@playwright/test` types). The mint types are a `.d.mts` sidecar so they
resolve for the `./lib/mint.mjs` import.

## Config (env, with local-dev defaults)

| Var                   | Default                     |
| --------------------- | --------------------------- |
| `E2E_API_BASE_URL`    | `https://local.bahar.dev`   |
| `E2E_WEB_BASE_URL`    | `http://localhost:5173`     |
| `E2E_CENTRAL_DB_URL`  | `http://localhost:8080`     |
| `E2E_CENTRAL_DB_TOKEN`| _(empty — local turso dev)_ |
| `E2E_TEST_EMAIL`      | `e2e@bahar.test`            |

The test user is created on first sign-in (sign-up is enabled for email OTP).

## Agent drivers

`_pw-*.mjs` are standalone browser drivers (no test runner). Copy
`_pw-example.mjs` to `_pw-<task>.mjs`, keep the storageState loading, and replace
the "drive the app" section. They regenerate the session automatically if
`e2e/.auth/state.json` is missing.
