import { dictionaryEntries } from "@bahar/drizzle-user-db-schemas";
import {
  buildDrizzleDb,
  type SyncAdapterDb,
  type SyncAdapterStatement,
} from "./turso-sync-adapter";

/**
 * Minimal stand-in for the native `Database`, which is a JSI binding and can't
 * load under jest-expo -- the reason the adapter is typed against a structural
 * interface in the first place. Records every statement it prepares, and
 * whether it ran inside a transaction.
 */
const createFakeDb = ({
  rows = [],
  failOnSql,
}: {
  rows?: Record<string, unknown>[];
  failOnSql?: string;
} = {}) => {
  const prepared: { sql: string; inTransaction: boolean }[] = [];
  const finalized: string[] = [];
  let transactionDepth = 0;

  const db: SyncAdapterDb = {
    prepare(sql: string): SyncAdapterStatement {
      prepared.push({ sql, inTransaction: transactionDepth > 0 });

      const guard = () => {
        if (failOnSql && sql.includes(failOnSql)) {
          throw new Error(`rejected: ${sql}`);
        }
      };

      return {
        run: async () => {
          guard();
          return { changes: 0, lastInsertRowid: 0n } as never;
        },
        all: async () => {
          guard();
          return rows as never;
        },
        get: async () => {
          guard();
          return rows[0] as never;
        },
        finalize: async () => {
          finalized.push(sql);
        },
      };
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      transactionDepth += 1;
      try {
        return await fn();
      } finally {
        transactionDepth -= 1;
      }
    },
  };

  return { db, prepared, finalized };
};

describe("buildDrizzleDb", () => {
  it("maps name-keyed rows to positional values for a query", async () => {
    const { db } = createFakeDb({
      rows: [{ id: "entry-1", word: "نور" }],
    });

    const drizzleDb = buildDrizzleDb(() => db);

    const result = await drizzleDb
      .select({ id: dictionaryEntries.id, word: dictionaryEntries.word })
      .from(dictionaryEntries);

    expect(result).toEqual([{ id: "entry-1", word: "نور" }]);
  });

  it("runs a batch inside a single transaction", async () => {
    const { db, prepared } = createFakeDb();

    const drizzleDb = buildDrizzleDb(() => db);

    await drizzleDb.batch([
      drizzleDb.insert(dictionaryEntries).values({
        id: "entry-1",
        word: "نور",
        translation: "light",
        type: "ism",
      }),
      drizzleDb.insert(dictionaryEntries).values({
        id: "entry-2",
        word: "قلم",
        translation: "pen",
        type: "ism",
      }),
    ]);

    expect(prepared).toHaveLength(2);
    // Both statements must run inside the transaction, or a multi-statement
    // operation could half-apply.
    expect(prepared.every((statement) => statement.inTransaction)).toBe(true);
  });

  it("finalizes statements even when one fails, and propagates the failure", async () => {
    const { db, finalized } = createFakeDb({ failOnSql: "insert" });

    const drizzleDb = buildDrizzleDb(() => db);

    // drizzle rewraps the driver error, so the assertion is that it surfaces
    // at all rather than being swallowed by the finally.
    await expect(
      drizzleDb.insert(dictionaryEntries).values({
        id: "entry-1",
        word: "نور",
        translation: "light",
        type: "ism",
      })
    ).rejects.toThrow();

    // Native statement handles leak over a session if a throw skips finalize.
    expect(finalized).toHaveLength(1);
  });

  it("returns empty results when the database isn't initialized yet", async () => {
    const drizzleDb = buildDrizzleDb(() => null);

    const result = await drizzleDb.select().from(dictionaryEntries);

    expect(result).toEqual([]);
  });
});
