# @bahar/drizzle-user-db-schemas

Drizzle ORM schemas for per-user databases in Bahar.

## Overview

This package contains the Drizzle schema definitions for user-specific databases. Each user in Bahar has their own SQLite database (hosted on Turso) containing:

- Dictionary entries
- Flashcards
- Study decks
- User settings

## Usage

```ts
import { dictionary, flashcards, decks, settings } from "@bahar/drizzle-user-db-schemas";
```

## Migration Generation

This package is used to generate SQL migration code for the schema registry. Drizzle is only used as a code generation tool here—migrations are **not** applied automatically at build time.

Instead, the generated SQL is manually added to the schema registry API by an admin at runtime. Clients then pull these migrations from the registry and apply them to their local databases.

### Generating Migrations

To generate new migration files after modifying schemas:

```bash
pnpm run --filter @bahar/drizzle-user-db-schemas drizzle:gen
```

This outputs SQL files to the `./drizzle` directory. The generated SQL should then be manually added to the schema registry via the admin API.
