---
name: bahar-data-access
description: >
  Explains how an agent can access a Bahar user's own dictionary and flashcard data:
  it lives in a personal Turso SQLite database that the agent queries directly with any
  SQL/libsql client, using the read-only token the `bahar` CLI hands back. Every change
  — adding, editing, deleting words, grading flashcards — goes through the CLI's write
  commands, which call the Bahar API. Use when a user asks to look up, search, review,
  or analyze their own dictionary entries, flashcards, decks, or study stats via chat —
  e.g. "what words am I struggling with", "add this word to my dictionary", "quiz me on
  my hardest cards", "how many words have I added this month".
---

# Bahar data access (for agents)

## Reads and writes take different paths

**Reads** go straight to the user's database. `bahar db-info` hands you a **read-only**
token, so you can run any query you like — arbitrary SQL, joins, aggregates — with no risk
of damaging anything.

**Writes** go through the `bahar` CLI commands below, which call the Bahar API. The token
you hold cannot write, so an `INSERT`/`UPDATE`/`DELETE` will simply be rejected by the
database. That's deliberate: the API applies changes with the same logic the web and
mobile apps use (flashcard creation, FSRS scheduling, sync timestamps), keeping invariants
that raw SQL silently breaks.

## Supported write actions

1. **Add words** — `bahar add` (see "Adding words"). Creates the entry *and* its
   flashcards atomically, so a word is never left without a review schedule.
2. **Edit words** — `bahar edit` (see "Editing words"). Bumps the sync timestamp and
   serializes JSON fields correctly.
3. **Grade flashcards** — `bahar grade` (see "Grading flashcards"). Runs the real FSRS
   algorithm, updates the streak, and records the review log.
4. **Delete words** — `bahar delete` (see "Deleting words"). Destructive and irreversible:
   it removes the entry and its flashcards, permanently losing their FSRS review history.
   Requires `--yes`, and you must warn the user and get explicit confirmation first.

Anything else that changes data — **deck management, settings, bulk rewrites, schema
changes** — has no write path available to you. Deck CRUD in particular used to be
possible with raw SQL and no longer is. Tell the user to make those changes in the web or
mobile app rather than attempting them.

## Where the data lives

Each Bahar user has their own personal SQLite database, hosted on Turso, separate from
the app's central database (auth, billing, etc.). The web and mobile apps sync a local
replica of it; you read the remote copy directly.

Because the apps sync on a ~60 second cycle, a change you make through the CLI shows up in
an app the user already has open only after its next pull. It is not lost, just not
instant — don't retry a write because it hasn't appeared yet.

## Step 1 — log in (once per machine)

```bash
bahar login
```

Opens the user's browser to sign in to their Bahar account, then stores a personal API
key locally (`~/.config/bahar/credentials.json`, or the platform equivalent). Only needs
to be run again if the user explicitly logs out or the key expires (keys minted this way
last 7 days). For an agent that runs unattended, the user can create a longer-lived or
non-expiring key in the web app under **Settings → API keys** and put it in
`credentials.json` instead — a non-expiring key stays valid until it's revoked there.

## Step 2 — get connection info

```bash
bahar db-info
```

Prints JSON with everything needed to connect: `hostname`, `db_name`, an `access_token`,
and `access_level: "read_only"`. The CLI caches the token and refreshes it when it nears
expiry, so call this rather than caching the token yourself.

## Step 3 — connect directly (reads)

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
  `lapses`, etc.) are FSRS algorithm state, not plain data. Reading them for
  study-coaching is safe; they can only be changed by `bahar grade`.
- The `access_token` from `bahar db-info` is a real credential scoped to that user's
  database. Read-only, but still theirs — don't print it to logs or persist it anywhere
  beyond what's needed to make the connection.

## Adding words

`bahar add` reads a JSON array of word objects on stdin and creates each dictionary entry
together with its flashcards in one atomic step.

```bash
echo '[{"word":"نور","translation":"light","type":"ism","tags":["nature"]}]' | bahar add

# Full usage, including every accepted field
bahar add help
```

Each word object requires `word`, `translation`, and `type` (`ism` | `fi'l` | `harf` |
`expression`); `definition`, `root`, `tags`, `antonyms`, `examples`, and `morphology` are
optional. Pass the JSON fields as real arrays/objects — the CLI serializes them.

A reverse (English → Arabic) card is created when the user's "create reverse cards by
default" setting is on, matching what the app does when they add a word by hand.

## Editing words

`bahar edit` takes a JSON array of `{ "id", ...fields }` objects on stdin. Only the fields
you include change; omit a field to leave it untouched, or pass `null` to clear a nullable
one. The sync timestamp is bumped for you.

```bash
echo '[{"id":"<entry-id>","translation":"light, glow","tags":["nature"]}]' | bahar edit

bahar edit help
```

Ids with no matching entry are reported in `missing` and skipped. Editable fields: `word`,
`translation`, `definition`, `type`, `root`, `tags`, `antonyms`, `examples`, `morphology`.

## Deleting words

Deleting is destructive and irreversible — it removes the entry and its flashcards and
permanently loses their FSRS review history. **Warn the user and get explicit confirmation
first.** `bahar delete` requires `--yes` to actually delete; without it, it prints what
would be deleted so you can confirm.

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

```bash
# Runs FSRS server-side, updates the flashcard, advances the streak, records the review
bahar grade <card-id> good        # one of: again | hard | good | easy

# Many cards at once (grade is always the last argument)
bahar grade <id1> <id2> good

# Per-card grades from stdin
echo '[{"id":"<id1>","grade":"good"},{"id":"<id2>","grade":"again"}]' | bahar grade

bahar grade help
```

Typical review flow:

1. Query due cards directly (`flashcards` where the card is due now and not hidden),
   joining `dictionary_entries` for the word/translation to quiz on.
2. Show the word to the user.
3. When they answer, run `bahar grade <card-id> <again|hard|good|easy>`.

However many cards you grade, one command is one request: every flashcard update lands in
a single batch and the streak advances once.

## The API behind the CLI

The CLI's write commands call the Bahar API, whose full schema is published at
`/openapi/json` (with a browsable reference at `/openapi`) on the API host. Prefer the CLI
— it handles auth, batching and output shape — but the schema is there when you need to
know exactly what a payload accepts.
