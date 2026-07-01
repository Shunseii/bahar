---
name: setup-local-env
description: >
  Bootstrap a fresh local dev environment for Bahar end-to-end — pull env vars from
  Infisical, start the local DB and cloudflared tunnel, run the app, create a working
  admin account, and register the per-user-db drizzle migrations into the central
  migrations table. Use when the user says "set up my local env", "fresh clone setup",
  "bootstrap bahar locally", "/setup-local-env", is onboarding to this repo for the
  first time, or is rebuilding local state after `make delete-local-data`.
---

# Setup Local Env (Bahar)

Runs the full loop from a bare clone to a working local instance with a logged-in-capable
admin account. Each step is idempotent — safe to re-run the whole skill on a machine that's
partially set up already; check state before acting rather than blindly re-running exports
or inserts.

## Steps

### 1. Prerequisites

Confirm these are installed before starting; don't install them yourself, just report what's
missing: `pnpm` (8.15.3), `bun`, `turso` CLI, `cloudflared`, `infisical` CLI, `op` (1Password
CLI — needed for the tunnel token in `make dev-backend`).

### 2. Env files (Infisical)

Check whether `apps/api/.env`, `apps/web/.env`, `apps/mobile/.env` already exist. For any
that are missing:

```bash
infisical login   # only if not already authenticated
infisical export --env=local --path=/api    --format=dotenv > apps/api/.env
infisical export --env=local --path=/web    --format=dotenv > apps/web/.env
infisical export --env=local --path=/mobile --format=dotenv > apps/mobile/.env
```

Don't overwrite files that already exist — `infisical export` doesn't check for you.

### 3. Install deps

```bash
pnpm install
```

### 4. Local DB + tunnel

```bash
make dev-backend
```

Runs `local-db` (`turso dev --db-file apps/api/local.db`, port 8080) and `tunnel`
(cloudflared, token pulled from 1Password) together. Run this in a separate terminal/
background process — it's long-running. The tunnel is only required for OAuth callbacks
and mobile dev; skip it if the user only cares about web.

### 5. Central DB schema

The local Turso file starts empty — apply the central app's own drizzle migrations
before starting the API (auth tables, `migrations` table, etc. all need to exist):

```bash
pnpm run --filter api drizzle:migrate
```

### 6. Run the app

```bash
pnpm run dev
```

Wait for the API log line `Listening on <host>:<port>.` and Vite's ready banner before
continuing — both API and web must be up for the next steps.

### 7. Register per-user-db migrations into the central schema table

**Do this before creating the admin account** — `setUpUserDb` (called on account creation)
only applies whatever is already in the central `migrations` table to a freshly provisioned
per-user database, so registering afterward would leave the new admin's own DB on an empty
schema.

```bash
cd apps/api
npx tsx --env-file=.env scripts/register-schema-migrations.ts
```

This reads `packages/drizzle-user-db-schemas/drizzle/*.sql`, replaces every
`--> statement-breakpoint` marker with a plain newline, and inserts each file as a row in
the central `migrations` table (skipping any already registered by filename). It bypasses
the `/migrations/register` HTTP endpoint on purpose — that endpoint requires an existing
admin, which doesn't exist yet on a fresh install.

### 8. Create the admin account

```bash
npx tsx --env-file=.env scripts/create-admin-user.ts <your-real-email>
```

Inserts the user directly into the central `users` table with `role: "admin"`, then calls
the same `setUpUserDb` used by real sign-ups to provision its per-user Turso database (now
populated with the migrations from step 7). Pass an email the user can actually receive mail
at — sign-up via email/password is disabled in this app, so logging into the web app still
goes through the normal `/sign-in/email-otp` flow with that same address; OTP sign-in
authenticates the existing user without touching its role.

### 9. Log in

Open `http://localhost:5173`, sign in with email OTP using the same email passed to step 8,
and confirm the account has admin access.

## Notes

- Per-user databases are always provisioned on real Turso cloud (the `testing` db group),
  even in local dev — only the *central* DB is the local `turso dev` file. Remind the user
  to run `make delete-local-data` (which also cleans the local file) and separately clean
  out the `testing` group in the Turso dashboard if they want a truly clean slate.
- All scripts in `apps/api/scripts/` are safe to re-run; re-running this whole skill on a
  half-set-up machine should just skip completed steps rather than erroring.
