# Bahar API

This is the back end API for Bahar.

## Getting Started

Install packages with `pnpm install`.

Run the local database with `turso dev`.

Run the migrations with `pnpm run --filter api drizzle:migrate` in the `packages/api` directory.

Run the dev servers with `turbo dev`.

Whenever you update the table in sqlite, run `pnpm run --filter api drizzle:gen` to generate the migration files.

Whenever you add any plugins that modify the auth tables (or if a better auth update adds new tables/columns), run `pnpm run --filter api auth:gen` to generate the migration files.

## Schema Registry

In this project, we are using a database per user architecture. Because of that, we need a mechanism to apply migrations to each user's database.

We do this through a schema registry which each client will pull and manually apply migrations to their database.

The exception to this is when we create user databases for new users on the server, we will automatically apply all migrations so that the new databases
are the latest version.

When adding migrations to the schema registry, we can have multiple SQL statements but make sure they are separated by a newline.
