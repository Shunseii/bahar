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

You may perform **only** these write actions against the user's database. For words and
flashcards, **use the `bahar` CLI commands below — do not write these with your own SQL.**
The commands run the same logic the app does (flashcard creation, FSRS, sync timestamps),
so they keep invariants a raw `INSERT`/`UPDATE` silently breaks.

1. **Add words** — **only** via `bahar add` (see "Adding words"). It creates the entry
   *and* its forward + reverse flashcards atomically. A raw SQL `INSERT` into
   `dictionary_entries` skips the flashcards, leaving the word with no review schedule —
   don't do it.
2. **Edit words** — **only** via `bahar edit` (see "Editing words"). It bumps the sync
   timestamp and serializes JSON fields correctly, which a hand-written `UPDATE` forgets.
3. **Grade flashcards** — record a spaced-repetition review, **only** via the `bahar grade`
   command (see "Grading flashcards"). Never hand-write FSRS fields.
4. **Delete words** — **only** via `bahar delete` (see "Deleting words"). Destructive and
   irreversible: it removes the entry and its flashcards, permanently losing their FSRS
   review history. Requires `--yes`, and you must warn the user and get explicit
   confirmation first.
5. **Manage decks** — full CRUD on `decks` (create, rename, edit filters, delete). Safe:
   a deck is just a saved filter config (`id`, `name`, `filters`), and `flashcards` hold
   no reference to it, so deleting a deck only removes that grouping — no card or review
   data is affected. No CLI command yet; SQL is acceptable here.

Reading/querying anything for lookup, search, or study-coaching is always fine — connect
directly (Step 3) for reads. Writes to words/flashcards go through the CLI, not SQL.

**Anything not on this list is unsupported and may cause irreversible damage to the user's
database. Assume there is no undo.** Do not do it even if the user asks, without first
warning them of the consequences and getting explicit confirmation. Unsupported includes
(non-exhaustive):

- **Deleting flashcards or `dictionary_entries` with raw SQL** — deleting an entry
  removes its flashcards and permanently loses their FSRS review history. Delete words
  only through `bahar delete` (with the user's explicit confirmation), never a raw
  `DELETE`. (Deleting *decks* is fine — see supported actions above.)
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

## Adding words

Add words with `bahar add`, which reads a JSON array of word objects on stdin and, for
each, creates the dictionary entry together with its forward + reverse flashcards in one
atomic step. This is the only correct way to add a word — a raw `INSERT` leaves the entry
with no flashcards and no review schedule.

```bash
echo '[{"word":"نور","translation":"light","type":"ism","tags":["nature"]}]' | bahar add

# Full usage, including every accepted field
bahar add help
```

Each word object requires `word`, `translation`, and `type` (`ism` | `fi'l` | `harf` |
`expression`); `definition`, `root`, `tags`, `antonyms`, `examples`, and `morphology` are
optional. Pass the JSON fields as real arrays/objects — the CLI serializes them.

## Editing words

Edit existing entries with `bahar edit`, a JSON array of `{ "id", ...fields }` objects on
stdin. Only the fields you include change; omit a field to leave it untouched, or pass
`null` to clear a nullable one. The command bumps the entry's sync timestamp for you.

```bash
echo '[{"id":"<entry-id>","translation":"light, glow","tags":["nature"]}]' | bahar edit

bahar edit help
```

Ids with no matching entry are reported and skipped. Editable fields: `word`,
`translation`, `definition`, `type`, `root`, `tags`, `antonyms`, `examples`, `morphology`.

## Deleting words

Deleting is destructive and irreversible — it removes the entry and its flashcards and
permanently loses their FSRS review history. **Warn the user and get explicit confirmation
first.** Then use `bahar delete`, which requires `--yes` to actually delete; without it,
it prints what would be deleted so you can confirm.

```bash
# Preview first (deletes nothing)
bahar delete <entry-id>

# Delete for real, after the user confirms
bahar delete <entry-id> --yes

# Many ids, or from stdin
bahar delete <id1> <id2> --yes
echo '["<id1>","<id2>"]' | bahar delete --yes

bahar delete help
```

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
