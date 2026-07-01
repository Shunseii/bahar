# Scripts Directory

This directory contains utility scripts for managing the Bahar application database and migrations.

## Available Scripts

### `create-user-dbs.ts`

Creates individual Turso databases for users who don't have one and applies all migrations.

**Purpose**: Sets up user-specific databases in Turso for all users that don't have a user database yet.

### `apply-user-db-migrations.ts`

Applies all pending schema migrations to each user's database.

**Purpose**: Ensures all user databases are up-to-date with the latest schema changes. This script checks the migrations table in each database and only applies migrations that haven't been run yet. It's safe to run multiple times.

Note: This script is for initial testing and administrative purposes. In production, clients manage their own databases and apply schemas themselves.

### `register-schema-migrations.ts`

Registers each per-user-db drizzle migration (`packages/drizzle-user-db-schemas/drizzle/*.sql`) into the central `migrations` table, stripping the `--> statement-breakpoint` markers into plain newlines.

**Purpose**: Bootstraps the central migration registry on a fresh local database, so `setUpUserDb`/`applyAllNewMigrations` have migrations to apply to new per-user Turso databases. Safe to run multiple times — skips files already registered (matched by filename).

### `create-admin-user.ts`

Creates a user directly in the central `users` table (bypassing the email-OTP sign-up flow), sets its role to `admin`, and provisions its per-user Turso database.

**Purpose**: Gives you a working admin account for local dev without a real signup round-trip. Pass a real email you can receive mail at — since email/password sign-up is disabled, logging into the app still goes through the normal `/sign-in/email-otp` flow with the same address. Safe to run multiple times — if the email already exists, it's just (re-)promoted to admin.

## Environment Setup

Before running any scripts, ensure you have the required environment variables configured:

1. **Copy the environment file**:

   ```bash
   cp apps/api/.env.example apps/api/.env  # if .env.example exists
   # or create apps/api/.env with required variables
   ```

2. **Required Environment Variables**:

   - `DATABASE_URL` - Turso central database URL
   - `DATABASE_AUTH_TOKEN` - Turso auth token
   - `TURSO_API_TOKEN` - Turso API token
   - `TURSO_ORGANIZATION` - Turso organization slug

Note: When running in docker, make sure to first run the services, then update any references to docker URLs with localhost.

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

## Running Scripts

### Using tsx directly

```bash
# From the project root
cd apps/api

# Load environment variables when running tsx
npx tsx --env-file=.env scripts/create-user-dbs.ts
npx tsx --env-file=.env scripts/apply-user-db-migrations.ts
npx tsx --env-file=.env scripts/register-schema-migrations.ts
npx tsx --env-file=.env scripts/create-admin-user.ts you@example.com
```

## Prerequisites

- Ensure all dependencies are installed (`pnpm install`)
- Verify environment variables are properly configured
- Ensure database connections are working

## Safety Notes

- These scripts modify production data - run with caution
- Test scripts in development environment first
- Scripts include error handling and logging for monitoring progress
- Always backup data before running migration scripts

## Troubleshooting

- Check environment variables if connection issues occur
- Verify service accessibility (Turso)
- Review logs for detailed error messages
- Ensure proper permissions for database operations
