import type { CardLayout } from "@bahar/drizzle-user-db-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "./test/create-test-db";

const dbRef = vi.hoisted(() => ({ current: undefined as TestDb | undefined }));

vi.mock(".", async (importOriginal) => ({
  ...(await importOriginal()),
  ensureDb: vi.fn(async () => dbRef.current?.db),
  getDb: vi.fn(() => dbRef.current?.db),
  getDrizzleDb: vi.fn(() => dbRef.current?.drizzleDb),
}));

const { settingsTable } = await import("./operations");

const LAYOUT: CardLayout = {
  version: 1,
  faces: {
    forward_question: ["word", "examples"],
    forward_answer: ["translation"],
    reverse_question: ["translation"],
    reverse_answer: ["word"],
  },
};

// The json-mode `card_layout` column round-trips through web's sqlite-proxy row
// mapping, which hands drizzle positional values from a name-keyed row. That
// mapping is web-specific, so a column whose value drizzle has to JSON.parse is
// only really covered against the sync-wasm engine.
describe("settingsTable card_layout (web wiring)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbRef.current = testDb;
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("reads settings when no layout has been saved", async () => {
    const settings = await settingsTable.getSettings.query();

    expect(settings.card_layout).toBeNull();
  });

  it("round-trips a saved layout", async () => {
    await settingsTable.getSettings.query();

    const saved = await settingsTable.update.mutation({
      updates: { card_layout: LAYOUT },
    });

    expect(saved.card_layout).toEqual(LAYOUT);

    const reread = await settingsTable.getSettings.query();

    expect(reread.card_layout).toEqual(LAYOUT);
  });

  it("resets back to the defaults", async () => {
    await settingsTable.getSettings.query();
    await settingsTable.update.mutation({ updates: { card_layout: LAYOUT } });

    const reset = await settingsTable.update.mutation({
      updates: { card_layout: null },
    });

    expect(reset.card_layout).toBeNull();
  });
});
