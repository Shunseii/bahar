# CLAUDE.md

## Overview

Bahar is an Arabic language learning app: personal dictionary, flashcards with spaced repetition (FSRS), study decks, RTL/LTR support.

## Architecture

| Layer    | Stack                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| Web      | React 19, Vite, Tanstack Router, Shadcn/UI, Tailwind CSS v4                        |
| Mobile   | React Native 0.81, Expo SDK 54, UniWind, file-based routing                        |
| API      | Bun, Elysia, Eden Treaty (type-safe client), Better Auth                           |
| Database | Turso (central + per-user SQLite DBs), Drizzle ORM                                 |
| Local DB | sync-wasm (web), Expo SQLite (mobile) — offline-first with 60s bi-directional sync |
| Search   | Orama (client-side WASM, Arabic + English)                                         |
| State    | Tanstack Query (server), Jotai (client)                                            |
| i18n     | Lingui v5                                                                          |
| Deploy   | Cloudflare Pages (web + marketing), Fly.io (API), EAS (mobile), Sentry             |

Shared packages live in `/packages`: `db-operations`, `design-system`, `drizzle-user-db-schemas`, `fsrs`, `i18n`, `result`, `search`.

## Commands

All commands run from monorepo root.

### Dev

```bash
make local-db                        # Local database (port 8080) — required for API
make tunnel                          # Cloudflared tunnel — required for mobile dev + OAuth
pnpm run dev                         # API + web + marketing dev servers
pnpm run start --filter mobile       # Mobile (requires API server + tunnel running)
```

Run `make local-db` and `make tunnel` in separate terminals before `pnpm run dev`. The
tunnel exposes the local API over HTTPS so the mobile dev client and OAuth callbacks (Apple
Sign In) can reach it. Web-only work doesn't strictly need the tunnel.

Individual servers: `pnpm run dev --filter api|web|marketing`

### Setup

```bash
pnpm install
pnpm run --filter api drizzle:migrate
```

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
