# Scripts Directory

This directory contains utility scripts for managing the Bahar application database and migrations.

## Available Scripts

### `create-user-dbs.ts`

Creates individual Turso databases for users who don't have one and applies all migrations.

**Purpose**: Sets up user-specific databases in Turso for all users that don't have a user database yet.

### `migrate-settings-decks-to-user-db.ts`

Migrates settings and decks data from the global database to each user's individual database.

**Purpose**: Move settings and decks tables from the central database to user-specific databases. This script is idempotent and can be run multiple times safely - it will skip records that already exist in the user database.

### `apply-user-db-migrations.ts`

Applies all pending schema migrations to each user's database.

**Purpose**: Ensures all user databases are up-to-date with the latest schema changes. This script checks the migrations table in each database and only applies migrations that haven't been run yet. It's safe to run multiple times.

Note: this is only for initial testing. It should not be run when new migrations are added once clients are managing the user databases and applying schemas themselves.

## Environment Setup

Before running any scripts, ensure you have the required environment variables configured:

1. **Copy the environment file**:

   ```bash
   cp apps/api/.env.example apps/api/.env  # if .env.example exists
   # or create apps/api/.env with required variables
   ```

2. **Required Environment Variables**:

   - Database connection variables (Turso credentials)
   - Meilisearch connection details
   - Authentication tokens
   - Refer to the main `.env` file for the complete list

Note: When running in docker, make sure to first run the services, then update any references to docker urls with localhost.

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
npx tsx --env-file=.env scripts/migrate-from-meilisearch.ts
npx tsx --env-file=.env scripts/migrate-settings-decks-to-user-db.ts
npx tsx --env-file=.env scripts/apply-user-db-migrations.ts
```

## Prerequisites

- Ensure all dependencies are installed (`pnpm install`)
- Verify environment variables are properly configured
- Ensure database connections are working
- For migration scripts, verify both source (Meilisearch) and target (Turso) services are accessible

## Safety Notes

- These scripts modify production data - run with caution
- Test scripts in development environment first
- Scripts include error handling and logging for monitoring progress
- Always backup data before running migration scripts

## Troubleshooting

- Check environment variables if connection issues occur
- Verify service accessibility (Turso, Meilisearch)
- Review logs for detailed error messages
- Ensure proper permissions for database operations
