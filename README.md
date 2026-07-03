[![StandWithPalestine](https://raw.githubusercontent.com/Safouene1/support-palestine-banner/master/StandWithPalestine.svg)](https://github.com/Safouene1/support-palestine-banner/blob/master/Markdown-pages/Support.md)

# Bahar

Bahar is an Arabic language learning application built as a monorepo using pnpm workspaces and Turborepo.

## Features

- Personal Arabic dictionary with detailed linguistic information
- Flashcard system with spaced repetition (FSRS algorithm)
- Custom study deck management with filtering capabilities
- Bidirectional flashcards (Arabic to English and English to Arabic)
- Support for RTL/LTR text and Arabic morphology
- Full-text search powered by Orama (client-side WASM)
- Local-first architecture with cloud sync

## Getting Started

1. Get the environment variables from Infisical (see [Environment variables](#environment-variables-infisical) below)
2. Run `pnpm run dev` and `make local-db`
3. Access the web app at `http://localhost:5173`
4. Access the API at `http://localhost:3000`
5. Access the marketing website at `http://localhost:4321`
6. To run drizzle studio to access the local database, run `pnpm run --filter api drizzle:studio`.
7. If you need to test payments or SSO providers (GitHub, Apple), set up a Cloudflare Tunnel by reading the instructions [here](./apps/api/README.md#local-development). SSO providers reject `http://localhost` callbacks, so the tunnel is required. When using the tunnel, you must also update `APP_DOMAIN` (api), `VITE_API_BASE_URL` (web), and `EXPO_PUBLIC_API_BASE_URL` (mobile) to the tunnel domain — all three must match or OAuth state cookies won't flow end-to-end.
8. Before you can sign up as a real user, run `pnpm run --filter api drizzle:migrate` to apply the central schema, then register the per-user-db migrations with `apps/api/scripts/register-schema-migrations.ts`. To skip the sign-up flow entirely and get a working admin account, use `apps/api/scripts/create-admin-user.ts <your-email>` — see [`apps/api/scripts/README.md`](./apps/api/scripts/README.md) for exact commands.

> **Tip:** if you're using Claude Code, the whole flow above (env vars, local DB/tunnel, running the app, migration registry, admin account) is automated by the `setup-local-env` skill in [`.claude/skills/setup-local-env`](./.claude/skills/setup-local-env/SKILL.md).

### Environment variables (Infisical)

Secrets are managed with [Infisical](https://infisical.com/). The repo is already linked to the workspace via the committed `.infisical.json` files, so there's no `infisical init` step — you just need the CLI and an account with access to the project.

1. **Install the CLI** — see the [official install docs](https://infisical.com/docs/cli/overview). On Debian/Ubuntu:

   ```bash
   curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | sudo -E bash
   sudo apt-get update && sudo apt-get install -y infisical
   ```

2. **Log in** (interactive; opens a browser — pick _Infisical Cloud (US Region)_):

   ```bash
   infisical login
   ```

3. **Export each app's secrets into its `.env`.** Secrets are organized into per-app folders (`/api`, `/web`, `/mobile`) under the `local` environment, so export each one to where its app expects it:

   ```bash
   infisical export --env=local --path=/api    --format=dotenv > apps/api/.env
   infisical export --env=local --path=/web    --format=dotenv > apps/web/.env
   infisical export --env=local --path=/mobile --format=dotenv > apps/mobile/.env
   ```

   The `.env` files are gitignored; the committed `.example.env` in each app lists the keys it expects. Re-run the relevant export whenever the secrets change in Infisical.

**Alternative — inject at runtime (no `.env` on disk).** Instead of exporting, wrap a per-app dev command so Infisical injects the secrets as environment variables. This matches the folder layout above:

```bash
cd apps/api && infisical run --env=local --path=/api -- bun run --watch src/index.ts
```

## Projects

### Apps

#### Web (`apps/web`)

React 19 SPA with local-first architecture:

- **Framework**: Vite, React 19
- **Routing**: TanStack Router
- **State**: TanStack Query (server), Jotai (client)
- **Styling**: Shadcn/UI, Tailwind CSS v4
- **Database**: Turso SQLite (local WASM sync + remote per-user)
- **Search**: Orama (client-side WASM)
- **i18n**: Lingui
- **Hosting**: Cloudflare Pages

#### Mobile (`apps/mobile`)

React Native app with Expo:

- **Framework**: Expo SDK 54, React Native 0.81
- **Routing**: Expo Router (file-based)
- **State**: TanStack Query (server), Jotai (client)
- **Styling**: UniWind (Tailwind for React Native)
- **Database**: Expo SQLite
- **Search**: Orama
- **i18n**: Lingui
- **Hosting**: Expo Application Services (EAS)

#### API (`apps/api`)

Bun backend:

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: Turso (central + per-user SQLite databases)
- **ORM**: Drizzle
- **Auth**: Better Auth (email OTP, OAuth)
- **Logging**: Pino, Sentry
- **Hosting**: Fly.io (Docker)

#### CLI (`apps/cli`)

Standalone command-line tool for querying your own dictionary/flashcard data directly
(e.g. from an AI agent) without a browser:

- **Framework**: Bun, bunli
- **Auth**: `bahar login` opens a browser, signs in via Better Auth, stores a personal
  API key locally
- **Data access**: `bahar db-info` prints direct Turso connection info — no REST API
  involved, same as web/mobile
- **Distribution**: standalone compiled binaries via GitHub Releases (see
  [Releasing the CLI](#releasing-the-cli) below)

Run `bahar skill install` to install the bundled
[`bahar-data-access`](./apps/cli/skill/SKILL.md) Claude Code skill, which explains this
flow to an agent.

#### Marketing (`apps/marketing`)

Static marketing site and blog:

- **Framework**: Astro 5
- **Styling**: Tailwind CSS v4
- **Content**: MDX for blog posts
- **i18n**: Native Astro (English + Arabic with RTL)
- **Hosting**: Cloudflare Pages

### Packages

| Package                          | Description                                |
| -------------------------------- | ------------------------------------------ |
| `@bahar/db-operations`           | Shared database operations                 |
| `@bahar/design-system`           | Shared design tokens (`cn()`, CSS)         |
| `@bahar/drizzle-user-db-schemas` | Drizzle schemas for per-user databases     |
| `@bahar/fsrs`                    | FSRS spaced repetition algorithm utilities |
| `@bahar/i18n`                    | Internationalization with Lingui           |
| `@bahar/result`                  | Result type for error handling             |
| `@bahar/search`                  | Orama search configuration                 |
| `@bahar/web-ui`                  | Shared shadcn/ui components (web only)     |
| `@bahar/typescript-config`       | Shared TypeScript configuration            |

## Development

### Prerequisites

- Node.js >= 18
- pnpm 8.15.3

### Commands

```bash
# Install dependencies
pnpm install

# Start all services (Docker)
docker compose up

# Build all packages
pnpm run build

# Run development servers
pnpm run dev

# Lint all packages
pnpm run lint

# Type check all packages
pnpm run type-check
```

## Database Management

```bash
# Run migrations
pnpm run --filter api drizzle:migrate

# Generate migration files
pnpm run --filter api drizzle:gen

# Generate Better Auth tables
pnpm run --filter api auth:gen

# Open Drizzle Studio
pnpm run --filter api drizzle:studio
```

## Releasing the CLI

The CLI has its own release pipeline (`.github/workflows/release-cli.yml`), separate
from the web/mobile app releases, since it publishes standalone binaries rather than
deploying anywhere:

1. One-time setup: set the `BAHAR_WEB_URL` and `BAHAR_API_URL` secrets (managed via
   Infisical, synced to GitHub Actions secrets) to the production web/API URLs — these
   get baked into the compiled binaries so the CLI doesn't default to localhost.
2. Cut a release by pushing a tag matching `cli-v*`:
   ```bash
   git tag cli-v1.0.0
   git push origin cli-v1.0.0
   ```
3. The workflow cross-compiles binaries for Linux, macOS (x64 + arm64), and Windows
   from a single runner and publishes them to a GitHub Release.

Use `cli-v*` (not plain `v*`) — this repo's web/mobile releases already use plain `v*`
tags, and both the CLI's self-update check and `install.sh`/`install.ps1` rely on the
prefix to find the right release instead of GitHub's repo-wide "latest release".

Users install via:

```bash
curl -fsSL https://raw.githubusercontent.com/Shunseii/bahar/main/apps/cli/scripts/install.sh | sh   # macOS/Linux
irm https://raw.githubusercontent.com/Shunseii/bahar/main/apps/cli/scripts/install.ps1 | iex          # Windows
```

## i18n

Internationalization is managed through the `@bahar/i18n` package using LinguiJS.

```bash
# Extract new translations
pnpm run i18n:extract

# Compile translations
pnpm run i18n:compile
```

After extracting, manually add translations in the `.po` files, then compile.
