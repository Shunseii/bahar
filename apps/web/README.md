# Bahar Web

The web application for Bahar - an Arabic language learning platform with personal dictionary, flashcards, and spaced repetition.

## Tech Stack

- React 19 with Vite for bundling
- TanStack Router for client-side routing
- TanStack Query for server state management
- Jotai for client state management
- Shadcn/UI + Tailwind CSS v4 for styling
- Lingui for internationalization
- Orama for client-side full-text search
- Turso SQLite (local WASM sync + remote per-user database)
- Eden Treaty for type-safe API communication

## Getting Started

Install packages with `pnpm install`.

## Development

Start the dev server with `pnpm dev`.

The web app runs on `http://localhost:4000`.

## Building

```bash
pnpm build
```

## Deployment

The app is deployed to Cloudflare Pages. Local preview with Wrangler:

```bash
pnpm wrangler:dev
```

## Architecture

This app uses a local-first architecture with cloud sync:

- **Local Database**: Browser-based SQLite via Turso sync-wasm
- **Server State**: Synced with user's remote Turso database every 60 seconds
- **Search**: Orama (client-side WASM) indexed from local database
- **API**: Elysia endpoints via Eden Treaty for type-safe server operations

## Data Flow

1. On app load, the local database is initialized and synced with the remote
2. Data reads happen from the local database (no network latency)
3. Data writes update the local database immediately
4. Background sync pushes changes to the server every 60 seconds
5. Search queries run against Orama's in-memory index

## UI Components (shadcn)

This app uses shadcn/ui components from the shared `@bahar/web-ui` package.

### Adding New Components

```bash
npx shadcn@latest add [component]
```

This installs components to `packages/web-ui/src/components/`.

### Importing Components

```tsx
import { Button } from "@bahar/web-ui/components/button";
import { Card } from "@bahar/web-ui/components/card";
import { cn } from "@bahar/web-ui/lib/utils";
```

See `packages/web-ui/README.md` for the full list of available components.

## Environment Variables

Required environment variables:

- `VITE_API_URL` - Backend API URL
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking
