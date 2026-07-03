---
name: bahar-data-access
description: >
  Explains how an agent can access a Bahar user's own dictionary and flashcard data:
  it lives in a personal Turso SQLite database (not behind a REST API), the `bahar`
  CLI handles login and hands back direct connection credentials, and the agent then
  queries that database directly with any SQL/libsql client. Use when a user asks to
  look up, search, review, or analyze their own dictionary entries, flashcards, decks,
  or study stats via chat — e.g. "what words am I struggling with", "add this word to
  my dictionary", "quiz me on my hardest cards", "how many words have I added this
  month".
---

# Bahar data access (for agents)

## Where the data lives

Each Bahar user has their own personal SQLite database, hosted on Turso, separate from
the app's central database (auth, billing, etc.). There is no REST API for dictionary or
flashcard data — the web and mobile apps connect to this per-user database directly, and
so should you.

## Step 1 — log in (once per machine)

```bash
bahar login
```

Opens the user's browser to sign in to their Bahar account, then stores a personal API
key locally (`~/.config/bahar/credentials.json`, or the platform equivalent). Only needs
to be run again if the user explicitly logs out or the key is revoked.

## Step 2 — get connection info

```bash
bahar db-info
```

Prints JSON with everything needed to connect: `hostname`, `db_name`, and a short-lived
`access_token` (refreshed automatically by the CLI's backend when it's close to
expiring, so always call this fresh rather than caching the token yourself).

## Step 3 — connect directly

Use any libsql-compatible client with the `hostname` and `access_token` from step 2,
e.g. in Node/Bun:

```ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: `libsql://${hostname}`,
  authToken: access_token,
});

const result = await client.execute("SELECT word, translation FROM dictionary_entries LIMIT 5");
```

Any language with a libsql/sqlite client works the same way — this isn't Node-specific.

## Step 4 — discover the schema live, don't assume it

Don't hardcode column names from this file into your queries. The schema evolves over
time (Bahar runs real migrations against it), so the only reliable source of truth is
the database itself:

```sql
SELECT name, sql FROM sqlite_master WHERE type = 'table';
```

Run this once at the start of a session to see the exact current columns before writing
queries, rather than guessing.

## Orientation — tables you'll typically care about

These names are stable; treat their *columns* as unknown until you've introspected them
per Step 4.

- `dictionary_entries` — the user's personal Arabic dictionary (word, translation,
  definition, morphology, tags, examples, etc.)
- `flashcards` — one row per study direction (forward/reverse) per dictionary entry,
  holding FSRS (spaced-repetition) scheduling state
- `decks` — user-defined groupings of flashcards
- `user_stats` — aggregate study stats
- `settings` — per-user app settings
- `migrations` — internal schema-version bookkeeping; not user data, ignore it

## Gotchas

- Several `dictionary_entries` columns (`root`, `tags`, `antonyms`, `examples`,
  `morphology`) are stored as JSON *text*. The web/mobile apps parse them through
  Drizzle's `mode: "json"` on the way out — a raw SQL client will hand you back the raw
  JSON string, so `JSON.parse()` (or your language's equivalent) it yourself.
- `flashcards` scheduling fields (`difficulty`, `stability`, `due`, `state`, `reps`,
  `lapses`, etc.) are FSRS algorithm state, not plain data. Reading them for
  study-coaching purposes is safe; writing to them to record a review requires running
  the actual FSRS update logic first (see `packages/fsrs` in this repo) — don't
  hand-write a new `due`/`state` value directly, it will desync the schedule.
  Straightforward additive writes (new dictionary entries, new flashcards/decks) don't
  have this concern.
- The `access_token` from `bahar db-info` is a real credential scoped to that user's
  database. Treat it like a password — don't print it to logs or persist it anywhere
  beyond what's needed to make the connection.
