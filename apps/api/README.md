# Bahar

This is the back end API for Bahar.

## Getting Started

Install packages with `pnpm install`.

Run the local database `turso dev`.

Run the migrations `pnpm run --filter api drizzle:migrate` in the `packages/api` directory.

Run the dev servers `turbo dev`.

Whenever you update the table in sqlite, run `pnpm run --filter api drizzle:gen` to generate the migration files. Then run the migrations.
