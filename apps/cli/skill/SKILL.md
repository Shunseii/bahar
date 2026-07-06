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

## Supported actions — and nothing else

You may perform **only** these write actions against the user's database:

1. **Add words** — insert new `dictionary_entries` (and, if asked, their `flashcards`).
2. **Edit words** — update fields on existing `dictionary_entries` (word, translation,
   definition, tags, examples, etc.).
3. **Grade flashcards** — record a spaced-repetition review, **only** via the `bahar grade`
   command (see "Grading flashcards" below). Never hand-write FSRS fields.
4. **Manage decks** — full CRUD on `decks` (create, rename, edit filters, delete). Safe:
   a deck is just a saved filter config (`id`, `name`, `filters`), and `flashcards` hold
   no reference to it, so deleting a deck only removes that grouping — no card or review
   data is affected.

Reading/querying anything for lookup, search, or study-coaching is always fine.

**Anything not on this list is unsupported and may cause irreversible damage to the user's
database. Assume there is no undo.** Do not do it even if the user asks, without first
warning them of the consequences and getting explicit confirmation. Unsupported includes
(non-exhaustive):

- **Deleting flashcards or `dictionary_entries`** — deleting an entry cascades to delete
  its flashcards and permanently loses their FSRS review history. (Deleting *decks* is
  fine — see supported actions above.)
- **Hand-editing FSRS scheduling fields** (`due`, `state`, `stability`, `difficulty`,
  `reps`, `lapses`, …) — desyncs the schedule. Use `bahar grade`.
- **Editing `user_stats` / streak directly** — `bahar grade` maintains these.
- **Touching the `migrations` table, or any DDL** (`DROP`/`ALTER`/`CREATE`) — breaks
  schema versioning and cross-device sync.
- **Changing primary keys** or the `(dictionary_entry_id, direction)` uniqueness on
  `flashcards` — breaks sync.
- **Bulk writes without a precise `WHERE`.**

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
to be run again if the user explicitly logs out or the key expires (keys last 7 days).

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
  `morphology`) are stored as JSON *text*. The app parses them on the way out — a raw
  SQL client will hand you back the raw JSON string, so `JSON.parse()` (or your
  language's equivalent) it yourself.
- `flashcards` scheduling fields (`difficulty`, `stability`, `due`, `state`, `reps`,
  `lapses`, etc.) are FSRS spaced-repetition algorithm state, not plain data. Reading
  them for study-coaching purposes is safe. **Never write them by hand** — a review must
  run the real FSRS algorithm (and also update the streak in `user_stats`), so always go
  through `bahar grade` (see below) rather than issuing your own `UPDATE`.
- The `access_token` from `bahar db-info` is a real credential scoped to that user's
  database. Treat it like a password — don't print it to logs or persist it anywhere
  beyond what's needed to make the connection.

## Grading flashcards

Grading is the one write you must **not** do with your own SQL — it needs the real FSRS
algorithm plus a streak update. Use the CLI exclusively, which owns both:

```bash
# Grade + persist: runs FSRS, updates the flashcard, updates the streak
bahar grade <card-id> good        # one of: again | hard | good | easy

# Full usage
bahar grade help
```

Typical review flow:

1. Query due cards directly (`flashcards` where the card is due now and not hidden),
   joining `dictionary_entries` for the word/translation to quiz on.
2. Show the word to the user.
3. When they answer, run `bahar grade <card-id> <again|hard|good|easy>` — the CLI writes
   the flashcard and streak for you.

Never build your own `UPDATE flashcards` for a review, and never edit `user_stats` /
streak yourself — `bahar grade` is the only supported path.
