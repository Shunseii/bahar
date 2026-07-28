import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { Rating } from "ts-fsrs";

/**
 * The router is exercised through `app.handle`, with its three collaborators
 * stubbed at the module boundary:
 *
 * - the auth guard, so a request doesn't need a real session (importing the
 *   real one pulls in the whole better-auth config, Redis and Polar),
 * - the central database, so revlog writes can be inspected,
 * - the user's database operations, so the tests cover what the router itself
 *   does -- batching, collating missing ids, mapping review logs to revlog
 *   rows. The operations' own behavior is covered in @bahar/db-operations.
 */
const revlogInserts: Record<string, unknown>[][] = [];

let operationsResult: {
  client: { close: () => void };
  dictionaryEntriesTable: Record<string, { mutation: MutationStub }>;
  flashcardsTable: Record<string, { mutation: MutationStub }>;
} | null = null;

let closedClients = 0;

/** Stands in for mutations with differing argument and result shapes. */
type MutationStub = (args: any) => Promise<any>;

mock.module("../middleware", () => ({
  betterAuthGuard: new Elysia({ name: "better-auth" }).macro({
    auth: () => ({
      resolve: () => ({ user: { id: "user-1" } }),
    }),
  }),
}));

mock.module("../db", () => ({
  db: {
    insert: () => ({
      values: (rows: Record<string, unknown>[]) => {
        revlogInserts.push(rows);
        return Promise.resolve();
      },
    }),
  },
}));

mock.module("../db/user-db", () => ({
  getUserOperations: () => Promise.resolve(operationsResult),
}));

const { dictionaryRouter } = await import("./dictionary");

const app = new Elysia().use(dictionaryRouter);

const send = (path: string, method: string, body?: unknown) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );

const entryNotFound = (id: string) =>
  new Error(`Dictionary entry not found: ${id}`);

const buildOperations = ({
  dictionaryEntriesTable = {},
  flashcardsTable = {},
}: {
  dictionaryEntriesTable?: Record<string, MutationStub>;
  flashcardsTable?: Record<string, MutationStub>;
}) => ({
  client: {
    close: () => {
      closedClients += 1;
    },
  },
  dictionaryEntriesTable: Object.fromEntries(
    Object.entries(dictionaryEntriesTable).map(([name, mutation]) => [
      name,
      { mutation },
    ])
  ),
  flashcardsTable: Object.fromEntries(
    Object.entries(flashcardsTable).map(([name, mutation]) => [
      name,
      { mutation },
    ])
  ),
});

beforeEach(() => {
  revlogInserts.length = 0;
  closedClients = 0;
  operationsResult = null;
});

describe("POST /dictionary/entries", () => {
  test("adds every word in the batch and reports its flashcard ids", async () => {
    const added: unknown[] = [];

    operationsResult = buildOperations({
      dictionaryEntriesTable: {
        addWordWithFlashcards: async ({ word, createReverse }) => {
          added.push({ word: word.word, createReverse });

          return {
            entry: { id: `entry-${added.length}`, word: word.word },
            forward: { id: `fc-${added.length}-f` },
            reverse: createReverse ? { id: `fc-${added.length}-r` } : null,
          };
        },
      },
    });

    const response = await send("/dictionary/entries", "POST", {
      words: [
        { word: "نور", translation: "light", type: "ism" },
        { word: "قلم", translation: "pen", type: "ism" },
      ],
      createReverse: true,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      added: [
        {
          id: "entry-1",
          word: "نور",
          flashcardIds: { forward: "fc-1-f", reverse: "fc-1-r" },
        },
        {
          id: "entry-2",
          word: "قلم",
          flashcardIds: { forward: "fc-2-f", reverse: "fc-2-r" },
        },
      ],
    });

    // The per-request override has to reach the mutation, otherwise the
    // account default silently wins.
    expect(added).toEqual([
      { word: "نور", createReverse: true },
      { word: "قلم", createReverse: true },
    ]);
    expect(closedClients).toBe(1);
  });

  test("rejects a word that fails validation before touching the database", async () => {
    let called = false;

    operationsResult = buildOperations({
      dictionaryEntriesTable: {
        addWordWithFlashcards: async () => {
          called = true;
          return {};
        },
      },
    });

    const response = await send("/dictionary/entries", "POST", {
      words: [{ word: "نور", translation: "light", type: "not-a-word-type" }],
    });

    expect(response.status).toBe(422);
    expect(called).toBe(false);
  });

  test("returns 404 when the user has no database yet", async () => {
    operationsResult = null;

    const response = await send("/dictionary/entries", "POST", {
      words: [{ word: "نور", translation: "light", type: "ism" }],
    });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /dictionary/entries", () => {
  test("edits what it can and collects ids that no longer exist", async () => {
    operationsResult = buildOperations({
      dictionaryEntriesTable: {
        editWord: async ({ id }) => {
          if (id === "gone") throw entryNotFound(id);

          return { id, word: "نور" };
        },
      },
    });

    const response = await send("/dictionary/entries", "PATCH", {
      edits: [
        { id: "entry-1", updates: { translation: "light, glow" } },
        { id: "gone", updates: { translation: "x" } },
      ],
    });

    expect(await response.json()).toEqual({
      edited: [{ id: "entry-1", word: "نور", updated: ["translation"] }],
      missing: ["gone"],
    });
  });

  test("lets an unexpected failure surface instead of reporting it as missing", async () => {
    operationsResult = buildOperations({
      dictionaryEntriesTable: {
        editWord: async () => {
          throw new Error("database is unreachable");
        },
      },
    });

    const response = await send("/dictionary/entries", "PATCH", {
      edits: [{ id: "entry-1", updates: { translation: "light" } }],
    });

    expect(response.status).toBe(500);
  });
});

describe("DELETE /dictionary/entries", () => {
  test("deletes what it can and collects ids that no longer exist", async () => {
    operationsResult = buildOperations({
      dictionaryEntriesTable: {
        delete: async ({ id }) => {
          if (id === "gone") throw entryNotFound(id);

          return { id, word: "نور" };
        },
      },
    });

    const response = await send("/dictionary/entries", "DELETE", {
      ids: ["entry-1", "gone"],
    });

    expect(await response.json()).toEqual({
      deleted: [{ id: "entry-1", word: "نور" }],
      missing: ["gone"],
    });
  });
});

describe("POST /dictionary/flashcards/grade", () => {
  const reviewLog = {
    rating: Rating.Good,
    state: 1,
    due: new Date("2026-07-27T00:00:00.000Z"),
    stability: 3.5,
    difficulty: 5.2,
    elapsed_days: 1,
    last_elapsed_days: 0,
    scheduled_days: 2,
    learning_steps: 0,
    review: new Date("2026-07-28T09:30:00.000Z"),
  };

  test("translates rating labels, records revlogs and returns the new due dates", async () => {
    let receivedGrades: unknown;
    let receivedTimezone: unknown;

    operationsResult = buildOperations({
      flashcardsTable: {
        grade: async ({ grades, timezone }) => {
          receivedGrades = grades;
          receivedTimezone = timezone;

          return {
            graded: [
              {
                id: "fc-1",
                due: "2026-07-30T00:00:00.000Z",
                direction: "forward",
                dictionary_entry_id: "entry-1",
                log: reviewLog,
              },
            ],
            missing: ["gone"],
          };
        },
      },
    });

    const response = await send("/dictionary/flashcards/grade", "POST", {
      grades: [
        { id: "fc-1", grade: "good" },
        { id: "gone", grade: "again" },
      ],
      timezone: "Asia/Tokyo",
    });

    expect(await response.json()).toEqual({
      graded: [{ id: "fc-1", due: "2026-07-30T00:00:00.000Z", grade: "good" }],
      missing: ["gone"],
    });

    // The wire format is a label; the operation takes ts-fsrs' numeric Rating.
    expect(receivedGrades).toEqual([
      { id: "fc-1", grade: Rating.Good },
      { id: "gone", grade: Rating.Again },
    ]);
    expect(receivedTimezone).toBe("Asia/Tokyo");

    expect(revlogInserts).toHaveLength(1);
    expect(revlogInserts[0]).toHaveLength(1);
    expect(revlogInserts[0][0]).toMatchObject({
      user_id: "user-1",
      dictionary_entry_id: "entry-1",
      direction: "forward",
      rating: "good",
      source: "review",
      due: "2026-07-27T00:00:00.000Z",
      due_timestamp_ms: reviewLog.due.getTime(),
      review: "2026-07-28T09:30:00.000Z",
      review_timestamp_ms: reviewLog.review.getTime(),
      stability: 3.5,
      difficulty: 5.2,
    });
  });

  test("writes no revlogs when nothing was graded", async () => {
    operationsResult = buildOperations({
      flashcardsTable: {
        grade: async () => ({ graded: [], missing: ["gone"] }),
      },
    });

    const response = await send("/dictionary/flashcards/grade", "POST", {
      grades: [{ id: "gone", grade: "good" }],
    });

    expect(await response.json()).toEqual({ graded: [], missing: ["gone"] });
    expect(revlogInserts).toHaveLength(0);
  });

  test("rejects an unknown rating label", async () => {
    const response = await send("/dictionary/flashcards/grade", "POST", {
      grades: [{ id: "fc-1", grade: "meh" }],
    });

    expect(response.status).toBe(422);
  });
});
