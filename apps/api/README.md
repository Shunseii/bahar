# Bahar API

This is the back end API for Bahar.

## Getting Started

Install packages with `pnpm install`.

Run the local database with `turso dev`.

Run the migrations with `pnpm run --filter api drizzle:migrate` in the `packages/api` directory.

Run the dev servers with `turbo dev`.

Whenever you update the table in sqlite, run `pnpm run --filter api drizzle:gen` to generate the migration files.

Whenever you add any plugins that modify the auth tables (or if a better auth update adds new tables/columns), run `pnpm run --filter api auth:gen` to generate the migration files.
