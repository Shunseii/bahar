# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview
Bahar is an Arabic language learning application with these key features:
- Personal Arabic dictionary with detailed linguistic information
- Flashcard system with spaced repetition (FSRS algorithm)
- Custom study deck management with filtering capabilities
- Bidirectional flashcards (Arabic → English and English → Arabic)
- Support for RTL/LTR text and Arabic morphology

## Technical Architecture

### Frontend
- Web app: React with Tanstack Router, Shadcn/UI components
- Mobile app: React Native with Expo framework and file-based routing
- Shared styling: Tailwind CSS (web) and NativeWind (mobile)
- Internationalization: Lingui (v5) for both web and mobile
- State management: Tanstack Query for server state, Jotai for client state

### Backend
- Node.js API with tRPC for type-safe APIs
- Turso (SQLite) for cloud database with Drizzle ORM
- Better Auth for authentication and session management
- Meilisearch for fast dictionary/flashcard search
- Redis for caching and session management

### Deployment
- Web app: Cloudflare Pages
- API: Fly.io with Docker containers
- Meilisearch: Fly.io with Docker containers
- Database: Turso Cloud
- Mobile app: Expo Application Services (EAS)

## Development Environment

### Docker Development Setup (Recommended)
- Start all services: `docker compose up`
- Front-end available at: http://localhost:4000
- API available at: http://localhost:3000
- Meilisearch available at: http://localhost:7700
- Drizzle Studio available at: http://localhost:4983

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

## Code Style Guidelines
- TypeScript with strict typing across entire codebase
- React components use functional style with hooks
- Web app uses Shadcn/UI components and Tailwind for styling
- Mobile app uses NativeWind (Tailwind for React Native)
- Error handling with try/catch blocks and structured error types
- State management: Tanstack Query for async state, Jotai for atomic state
- Component naming: PascalCase for components, camelCase for functions/variables
- Mobile app uses Expo with file-based routing
- Web app uses Tanstack Router for client-side routing