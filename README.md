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

1. Get the environment variables from Infisical
2. Run `pnpm run dev` and `make local-db`
3. Access the web app at `http://localhost:5173`
4. Access the API at `http://localhost:3000`
5. Access the marketing website at `http://localhost:4321`
6. To run drizzle studio to access the local database, run `pnpm run --filter api drizzle:studio`.
7. If you need to test payments, make sure to set up a Cloudflare Tunnel by reading the instructions [here](./apps/api/README.md#local-development).

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

## i18n

Internationalization is managed through the `@bahar/i18n` package using LinguiJS.

```bash
# Extract new translations
pnpm run i18n:extract

# Compile translations
pnpm run i18n:compile
```

After extracting, manually add translations in the `.po` files, then compile.
