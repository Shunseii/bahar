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

## Schema Registry

The schemas are also exported as SQL migrations in the schema registry, which clients pull and apply to their local databases.
