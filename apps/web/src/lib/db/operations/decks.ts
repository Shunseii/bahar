import { SelectDeck, RawDeck } from "@bahar/drizzle-user-db-schemas";
import { getDb } from "..";
import { nanoid } from "nanoid";
import { TableOperation } from "./types";

export const decksTable = {
  list: {
    query: async ({
      show_reverse,
    }: {
      show_reverse?: boolean;
    }): Promise<(SelectDeck & { to_review: number; total_hits: number })[]> => {
      try {
        const db = getDb();
        const now = Date.now();

        const rawDecks: RawDeck[] = await db
          .prepare("SELECT id, name, filters FROM decks")
          .all();

        const decks = rawDecks.map<SelectDeck>((rawDeck) => ({
          ...rawDeck,
          filters: rawDeck.filters ? JSON.parse(rawDeck.filters) : null,
        }));

        const enrichedDecks = await Promise.all(
          decks.map(async (deck) => {
            try {
              const {
                tags = [],
                types = ["ism", "harf", "fi'l", "expression"],
                state = [0, 1, 2, 3],
              } = deck.filters ?? {};

              const directions = show_reverse
                ? ["forward", "reverse"]
                : ["forward"];

              const whereConditions: string[] = [];
              const toReviewParams: unknown[] = [];
              const totalHitsParams: unknown[] = [];

              whereConditions.push(
                `f.direction IN (${directions.map(() => "?").join(", ")})`,
              );
              toReviewParams.push(...directions);
              totalHitsParams.push(...directions);

              whereConditions.push(
                `f.state IN (${state.map(() => "?").join(", ")})`,
              );
              toReviewParams.push(...state);
              totalHitsParams.push(...state);

              whereConditions.push(
                `d.type IN (${types.map(() => "?").join(", ")})`,
              );
              toReviewParams.push(...types);
              totalHitsParams.push(...types);

              if (tags.length > 0) {
                whereConditions.push(
                  `EXISTS (SELECT 1 FROM json_each(d.tags) WHERE value IN (${tags
                    .map(() => "?")
                    .join(", ")}))`,
                );
                toReviewParams.push(...tags);
                totalHitsParams.push(...tags);
              }

              whereConditions.push("f.is_hidden = 0");

              const whereClause = whereConditions.join(" AND ");

              const toReviewSql = `SELECT COUNT(*) as count FROM flashcards f LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id WHERE f.due_timestamp_ms <= ? AND ${whereClause}`;
              const toReviewAllParams = [now, ...toReviewParams];
              console.debug("Executing toReview query:", {
                sql: toReviewSql,
                params: toReviewAllParams,
                deckId: deck.id,
                deckName: deck.name,
              });

              const toReviewCount: { count: number } = await db
                .prepare(toReviewSql)
                .get(toReviewAllParams);

              console.debug("toReview result:", toReviewCount);

              const totalHitsSql = `SELECT COUNT(*) as count FROM flashcards f LEFT JOIN dictionary_entries d ON f.dictionary_entry_id = d.id WHERE ${whereClause}`;

              console.debug("Executing totalHits query:", {
                sql: totalHitsSql,
                params: totalHitsParams,
                deckId: deck.id,
                deckName: deck.name,
              });

              const totalHitsCount: { count: number } = await db
                .prepare(totalHitsSql)
                .get([...totalHitsParams]);

              console.debug("totalHits result:", totalHitsCount);

              return {
                ...deck,
                to_review: toReviewCount?.count ?? 0,
                total_hits: totalHitsCount?.count ?? 0,
              };
            } catch (err) {
              console.error("Error processing deck", err);
              throw err;
            }
          }),
        );

        return enrichedDecks;
      } catch (err) {
        console.error("Error in decksTable.list", err);

        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.list"],
    },
  },
  create: {
    mutation: async ({
      deck,
    }: {
      deck: Omit<SelectDeck, "id">;
    }): Promise<SelectDeck> => {
      try {
        const db = getDb();
        const id = nanoid();

        await db
          .prepare(`INSERT INTO decks (id, name, filters) VALUES (?, ?, ?);`)
          .run([
            id,
            deck.name,
            deck.filters ? JSON.stringify(deck.filters) : null,
          ]);

        await db.push();

        const res: RawDeck = await db
          .prepare(`SELECT * FROM decks WHERE id = ?;`)
          .get([id]);

        return {
          ...res,
          filters: res.filters ? JSON.parse(res.filters) : null,
        };
      } catch (err) {
        console.error("Error in decksTable.create", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.create"],
    },
  },
  update: {
    mutation: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<SelectDeck, "id">>;
    }): Promise<SelectDeck> => {
      try {
        const db = getDb();

        const setClauses: string[] = [];
        const params: unknown[] = [];

        if ("name" in updates && updates.name !== undefined) {
          setClauses.push("name = ?");
          params.push(updates.name);
        }
        if ("filters" in updates && updates.filters !== undefined) {
          setClauses.push("filters = ?");
          params.push(updates.filters ? JSON.stringify(updates.filters) : null);
        }

        if (setClauses.length === 0) {
          throw new Error("No fields to update");
        }

        params.push(id);

        await db
          .prepare(`UPDATE decks SET ${setClauses.join(", ")} WHERE id = ?;`)
          .run(params);

        await db.push();

        const res: RawDeck = await db
          .prepare(`SELECT * FROM decks WHERE id = ?;`)
          .get([id]);

        return {
          ...res,
          filters: res.filters ? JSON.parse(res.filters) : null,
        };
      } catch (err) {
        console.error("Error in decksTable.update", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.update"],
    },
  },
  delete: {
    mutation: async ({ id }: { id: string }): Promise<{ success: boolean }> => {
      try {
        const db = getDb();

        await db.prepare(`DELETE FROM decks WHERE id = ?;`).run([id]);

        await db.push();

        return { success: true };
      } catch (err) {
        console.error("Error in decksTable.delete", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.decks.delete"],
    },
  },
} satisfies Record<string, TableOperation>;
