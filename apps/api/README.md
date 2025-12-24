# Bahar API

The backend API for Bahar - an Arabic language learning platform.

## Tech Stack

- **Framework**: Express with tRPC for type-safe APIs
- **Database**: Turso (LibSQL) - central database + per-user databases
- **ORM**: Drizzle ORM
- **Auth**: Better Auth (email OTP, OAuth)
- **Logging**: Pino for structured logging
- **Error Tracking**: Sentry
- **Session Cache**: Upstash Redis

## Architecture

### Database-per-User Design

The API uses a database-per-user architecture:

- **Central Database**: Stores shared auth data (users, sessions, accounts)
- **Per-User Databases**: Each user has their own Turso database for personal data (dictionary entries, flashcards, decks)

This design provides:
- Data isolation between users
- Independent scaling per user
- Simplified backup and restore

### Schema Registry

Because each user has their own database, migrations are managed through a schema registry:

1. Clients pull the schema registry on app load
2. Clients apply any pending migrations to their local database
3. New user databases are automatically initialized with the latest schema

When adding migrations, SQL statements should be separated by newlines.

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm
- Turso CLI (for local development)

### Installation

```bash
pnpm install
```

### Local Development

1. Start the local database:
   ```bash
   turso dev --db-file local.db
   # or from project root:
   make local-db
   ```

2. Run migrations:
   ```bash
   pnpm run drizzle:migrate
   ```

3. Start the dev server:
   ```bash
   pnpm dev
   ```

The API runs on `http://localhost:3000`.

## Database Commands

```bash
# Generate migration files after schema changes
pnpm run drizzle:gen

# Run migrations
pnpm run drizzle:migrate

# Push schema directly (dev only)
pnpm run drizzle:push

# Open Drizzle Studio
pnpm run drizzle:studio

# Generate Better Auth tables after plugin changes
pnpm run auth:gen
```

## Scripts

Utility scripts for database management are in `/scripts`:

- `create-user-dbs.ts` - Create individual Turso databases for users
- `apply-user-db-migrations.ts` - Apply schema migrations to user databases
- `migrate-settings-decks-to-user-db.ts` - Migrate data from central to user databases

Run scripts with:
```bash
npx tsx --env-file=.env scripts/<script-name>.ts
```

## Building

```bash
pnpm run build
```

The built output is in `/dist`.

## Running in Production

```bash
pnpm start
```

## Environment Variables

Required environment variables:

- `DATABASE_URL` - Turso central database URL
- `DATABASE_AUTH_TOKEN` - Turso auth token
- `TURSO_API_TOKEN` - Turso API token for per-user database management
- `TURSO_ORGANIZATION` - Turso organization slug
- `BETTER_AUTH_SECRET` - Secret for Better Auth
- `REDIS_URL` - Upstash Redis URL
- `REDIS_TOKEN` - Upstash Redis token
- `SENTRY_DSN` - Sentry DSN for error tracking
