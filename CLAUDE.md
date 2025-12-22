# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

Bahar is an Arabic language learning application with these key features:

- Personal Arabic dictionary with detailed linguistic information
- Flashcard system with spaced repetition (FSRS algorithm)
- Custom study deck management with filtering capabilities
- Bidirectional flashcards (Arabic to English and English to Arabic)
- Support for RTL/LTR text and Arabic morphology

## Technical Architecture

### Frontend

- Web app: React 19 with Vite, Tanstack Router, Shadcn/UI components
- Mobile app: React Native 0.81 with Expo SDK 54 and file-based routing
- Shared styling: Tailwind CSS v4 (web) and UniWind (mobile)
- Internationalization: Lingui (v5) for both web and mobile
- State management: Tanstack Query for server state, Jotai for client state
- Search: Orama (client-side WASM search engine with Arabic support)

### Backend

- Node.js API with Express and tRPC for type-safe APIs
- Authentication: Better Auth with email OTP and OAuth support
- Logging: Pino for structured logging, Sentry for error tracking

### Database & Storage

- **Central Database (Turso)**: Shared auth data, users, sessions, accounts
- **Per-User Databases (Turso)**: Each user has individual SQLite database for personal data (dictionary, flashcards, decks)
- **Local Database (Web)**: Browser-side SQLite via sync-wasm with bi-directional sync to user's Turso database
- **Local Database (Mobile)**: Expo SQLite for offline-first data storage
- **ORM**: Drizzle ORM for database operations
- **Session Management**: Upstash Redis for session caching

### Deployment

- Web app: Cloudflare Pages
- API: Fly.io with Docker containers
- Database: Turso Cloud (central + per-user databases)
- Mobile app: Expo Application Services (EAS)
- Marketing site: Cloudflare Pages (Astro 5)
- Error tracking: Sentry

## Development Environment

### Docker Development Setup (Recommended)

- Start all services: `docker compose up`
- Front-end available at: http://localhost:4000
- API available at: http://localhost:3000
- Drizzle Studio available at: http://localhost:4983
- LibSQL Server available at: http://localhost:8080 (local development database)

### Local Development

- Install packages: `pnpm install`
- Build all: `pnpm run build` or `turbo build`
- Dev mode: `pnpm run dev` or `turbo dev`
- Lint all: `pnpm run lint` or `turbo lint`
- Type check: `pnpm run type-check` or `turbo type-check`
- Local database: `turso dev --db-file apps/api/local.db` or `make local-db`

### Production Setup

- Build and run production: `make prod`
- Build production web app: `make build`
- Run production containers: `docker compose -f docker-compose.prod.yaml up -d`
- Serve production web app: `make serve`
- Cleanup production environment: `make cleanup`

## Testing

- Run tests (mobile): `cd apps/mobile && pnpm test`
- Run specific test: `cd apps/mobile && pnpm test -t "test name"`

## Database Management

- Run migrations: `pnpm run --filter api drizzle:migrate`
- Generate migration files: `pnpm run --filter api drizzle:gen`
- Update auth tables: `pnpm run --filter api auth:gen`
- View database: `pnpm run --filter api drizzle:studio`

## i18n Management

- Extract translations: `pnpm run i18n:extract`
- Compile translations: `pnpm run i18n:compile`

## Shared Packages

The monorepo includes shared packages in `/packages`:

- `@bahar/db-operations`: Shared database operation utilities
- `@bahar/design-system`: Shared design tokens and components
- `@bahar/drizzle-user-db-schemas`: Drizzle schemas for per-user databases
- `@bahar/fsrs`: FSRS spaced repetition algorithm utilities
- `@bahar/i18n`: Internationalization with Lingui
- `@bahar/result`: Result type for explicit error handling
- `@bahar/schemas`: Shared Zod validation schemas
- `@bahar/search`: Orama search configuration and utilities

## Web App Data Flow

### Local-First Architecture with Cloud Sync

The web app uses a hybrid approach with local-first data handling:

1. **Initialization** (on authorized route load):

   - Opens local Turso database via sync-wasm
   - Pulls latest changes from user's remote Turso database
   - Hydrates Orama search index from local database (batches of 500 items)
   - Initializes background sync interval

2. **Reading Data**:

   - Dictionary, flashcards, decks are read from local database
   - Search queries use Orama (in-memory, client-side)
   - No API calls needed for reads

3. **Writing Data**:

   - Create/update/delete operations write to local database immediately
   - API also writes to remote user database (dual-write pattern during migration)
   - Background sync pushes local changes to remote every 60 seconds

4. **Synchronization**:
   - Pull: Fetches remote changes every 60 seconds
   - Push: Sends local changes to remote every 60 seconds
   - Conflict resolution: Last-write-wins strategy

### Error Handling

- `DisplayError` class provides user-friendly error messages
- `Result<T, E>` type for explicit error handling (Rust-like pattern)
- Structured logging with Sentry integration

### Search (Orama)

- Client-side WASM search engine
- Multi-language support (Arabic + English)
- Indexed from local database on app initialization
- Features: stemming, stopwords, quantized positional search (QPS)

## Code Style Guidelines

- TypeScript with strict typing across entire codebase
- Do not use `any` type unless absolutely necessary
- Write self-documenting code and avoid overuse of comments
- React components use functional style with hooks
- Prefer using jotai atoms over React Context
- Web app uses Shadcn/UI components and Tailwind CSS v4 for styling
  - Use the `cn()` utility function for combining and conditionally applying Tailwind classes
  - Example: `cn("px-4 py-2", isActive && "bg-blue-500", disabled && "opacity-50")`
- Mobile app uses UniWind (Tailwind for React Native) with Tailwind CSS v4
- Error handling with try/catch blocks and structured error types
- State management: Tanstack Query for async state, Jotai for atomic state
- Component naming: PascalCase for components, camelCase for functions/variables
- Mobile app uses Expo with file-based routing (Expo Router)
- Web app uses Tanstack Router for client-side routing
