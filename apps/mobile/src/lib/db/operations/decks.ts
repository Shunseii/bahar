/**
 * Decks operations for mobile — thin wiring over the shared
 * @bahar/db-operations factory, plus a mobile-only `get` (fetch one deck by
 * id), which the shared package doesn't expose.
 */

import { makeDecksTable } from "@bahar/db-operations";
import {
  decks as decksSchema,
  type SelectDeck,
} from "@bahar/drizzle-user-db-schemas";
import { eq } from "drizzle-orm";
import { getDb } from "./get-db";

export type DeckWithCounts = SelectDeck & {
  to_review: number;
  to_review_backlog: number;
  total_hits: number;
};

const base = makeDecksTable({ getDb });

export const decksTable = {
  ...base,
  // Preserve mobile's no-arg-callable list (the shared factory requires an
  // options object).
  list: {
    query: (
      args: { show_reverse?: boolean; backlogThresholdDays?: number } = {}
    ) => base.list.query(args),
    cacheOptions: base.list.cacheOptions,
  },
  get: {
    query: async ({ id }: { id: string }): Promise<SelectDeck | null> => {
      const drizzleDb = await getDb();
      const [res] = await drizzleDb
        .select()
        .from(decksSchema)
        .where(eq(decksSchema.id, id))
        .limit(1);
      return res ?? null;
    },
    cacheOptions: {
      queryKey: ["turso.decks.get"] as const,
    },
  },
};
