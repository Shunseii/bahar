# Bahar Web

The web application for Bahar - an Arabic language learning platform with personal dictionary, flashcards, and spaced repetition.

## Tech Stack

- React 19 with Vite for bundling
- TanStack Router for client-side routing
- TanStack Query for server state management
- Jotai for client state management
- Shadcn/UI + Tailwind CSS for styling
- Lingui for internationalization
- Orama for client-side full-text search
- Turso SQLite (local WASM sync + remote per-user database)
- tRPC for type-safe API communication

## Getting Started

Install packages with `pnpm install`.

## Development

Start the dev server with `pnpm dev`.

The web app runs on `http://localhost:4000`.

## Architecture

This app uses a local-first architecture with cloud sync:

- **Local Database**: Browser-based SQLite via Turso sync-wasm
- **Server State**: Synced with user's remote Turso database every 60 seconds
- **Search**: Orama (client-side WASM) indexed from local database
- **API**: tRPC endpoints for data mutations and server operations

## Data Flow

1. On app load, the local database is initialized and synced with the remote
2. Data reads happen from the local database (no network latency)
3. Data writes update the local database immediately
4. Background sync pushes changes to the server every 60 seconds
5. Search queries run against Orama's in-memory index
