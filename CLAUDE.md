# CLAUDE.md

## Overview

Bahar is an Arabic language learning app: personal dictionary, flashcards with spaced repetition (FSRS), study decks, RTL/LTR support.

## Architecture

| Layer    | Stack                                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| Web      | React 19, Vite, Tanstack Router, Shadcn/UI, Tailwind CSS v4                                 |
| Mobile   | React Native 0.81, Expo SDK 54, UniWind, file-based routing                                 |
| API      | Bun, Elysia, Eden Treaty (type-safe client), Better Auth                                    |
| Database | Turso (central + per-user SQLite DBs), Drizzle ORM                                          |
| Local DB | Turso sync: sync-wasm (web), sync-react-native (mobile) — offline-first, 60s bi-directional |
| Search   | Orama (client-side WASM, Arabic + English)                                                  |
| State    | Tanstack Query (server), Jotai (client)                                                     |
| i18n     | Lingui v5                                                                                   |
| Deploy   | Cloudflare Pages (web + marketing), Fly.io (API), EAS (mobile), Sentry                      |

Shared packages live in `/packages`: `db-operations`, `design-system`, `drizzle-user-db-schemas`, `fsrs`, `i18n`, `result`, `search`.

## Commands

All commands run from monorepo root.

### Dev

```bash
make dev-backend                     # Local DB (port 8080) + cloudflared tunnel, together
pnpm run dev                         # API + web + marketing dev servers
pnpm run start --filter mobile       # Mobile (requires make dev-backend + pnpm run dev)
```

Run `make dev-backend` in its own terminal before `pnpm run dev`. It runs `make local-db` and
`make tunnel` in parallel and pulls the tunnel token from 1Password, so the `op` CLI has to be
signed in.

The tunnel is not optional for day-to-day work: `APP_DOMAIN` (api), `VITE_API_BASE_URL` (web),
and `EXPO_PUBLIC_API_BASE_URL` (mobile) all point at the tunnel domain, so without it the web
app has no reachable API. SSO providers also reject `http://localhost` callbacks. Those three
must always name the same host or OAuth state cookies won't flow end-to-end — see
[apps/api/README.md](./apps/api/README.md#local-development).

Individual pieces, when you need them separately: `make local-db`, `make tunnel`.

Individual servers: `pnpm run dev --filter api|web|marketing`

### Setup

```bash
pnpm install
pnpm run --filter api drizzle:migrate
```

For a full fresh-clone bootstrap (env vars from Infisical, local DB/tunnel, running the app,
registering per-user-db migrations into the central schema table, and creating a working
admin account), use the `setup-local-env` skill (`.claude/skills/setup-local-env`) instead of
doing these steps by hand.

### Database

```bash
pnpm run --filter api drizzle:gen       # Generate migration files
pnpm run --filter api drizzle:migrate   # Run migrations
pnpm run --filter api auth:gen          # Update auth tables
pnpm run --filter api drizzle:studio    # DB UI (port 4983)
```

### Build / Lint / Test

```bash
pnpm run format-and-lint:fix         # Format and lint with auto-fix
pnpm run build                       # Build all
pnpm run type-check                  # Type check all
cd apps/mobile && pnpm test          # Run mobile tests
```

### i18n

```bash
pnpm run i18n:extract
pnpm run i18n:compile
```

### Production

```bash
make build                           # Build production web app
make serve                           # Serve production web app locally
make delete-local-data               # Delete local databases
```

## Code Style

- Strict TypeScript everywhere — no `any` unless unavoidable
- Self-documenting code, minimal comments
- Prefer Jotai atoms over React Context
- Use `cn()` for conditional Tailwind classes
- `Result<T, E>` for explicit error handling, `DisplayError` for user-facing errors
- PascalCase components, camelCase functions/variables

## Debugging Sentry Issues

- To correlate a Sentry Logs call (`Sentry.logger.*`) with the error/trace it happened around, filter Sentry's Logs explorer by `trace:<trace_id>` — don't rely on breadcrumbs, Sentry has deprecated manual breadcrumbs in favor of Logs and `Sentry.logger.*` calls never show up as breadcrumbs.
- Sentry's distributed tracing already links a frontend event to its backend `bahar-api` spans under the same `trace_id` automatically (via `tracePropagationTargets`) — no extra plumbing needed to jump between frontend and backend within Sentry itself.
- This only breaks down for raw `fly logs` stdout, which uses pino's own `traceId` (`X-Request-Id`), unrelated to Sentry's `trace_id`.

## AI Assistance Policy

- Do not implement large features or big chunks of code autonomously. Default to spotting bugs and suggesting improvements, not writing the fix, unless explicitly asked to fix it.
- Small, scoped code changes are fine when the user asks for them directly.
- Any code written must strictly follow existing patterns in the surrounding codebase — no new abstractions, libraries, or conventions introduced on your own initiative.
- Prioritize testing. If you notice meaningful missing test coverage, flag it or write it.
