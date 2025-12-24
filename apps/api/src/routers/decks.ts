import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  InsertDecksSchema,
  SelectDecksSchema,
  decks,
} from "../db/schema/decks";
import { z } from "zod";
import { FLASHCARD_LIMIT, queryFlashcards } from "./flashcard";
import { getUserDbClient } from "../clients/turso";

export const decksRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({ show_reverse: z.boolean().default(false).optional() })
        .optional(),
    )
    .output(
      z.array(
        SelectDecksSchema.extend({
          to_review: z.number(),
          total_hits: z.number(),
        }),
      ),
      // TODO: This optional will break types on the client.
      // First appeared after upgrading to typescript v5.8.3 and trpc v11.4.3
      // related issue: https://github.com/trpc/trpc/issues/6521
      // .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { show_reverse } = input ?? {};

      const userDbClient = await getUserDbClient(user.id);

      if (!userDbClient) {
        return [];
      }

      const result = await userDbClient.execute(
        "SELECT id, name, filters FROM decks LIMIT 20",
      );

      const results = result.rows.map((row) => ({
        id: row.id as string,
        user_id: user.id,
        name: row.name as string,
        filters: row.filters ? JSON.parse(row.filters as string) : null,
      }));

      const res = await Promise.all(
        results.map(async (result) => {
          const filters = result.filters;

          const { flashcards, totalHits } = await queryFlashcards({
            user_id: user.id,
            fields: ["id"],
            limit: FLASHCARD_LIMIT,
            show_only_today: true,
            filters,
            show_reverse,
          });

          return {
            ...result,
            to_review: flashcards.length,
            total_hits: totalHits,
          };
        }),
      );

      return res;
    }),

  create: protectedProcedure
    .input(InsertDecksSchema.omit({ id: true, user_id: true }))
    .output(SelectDecksSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const results = await db
        .insert(decks)
        .values({ id: nanoid(), user_id: user.id, ...input })
        .returning();

      const result = results[0];

      return result;
    }),

  update: protectedProcedure
    .input(InsertDecksSchema.pick({ id: true, name: true, filters: true }))
    .output(SelectDecksSchema)
    .mutation(async ({ input }) => {
      const results = await db
        .update(decks)
        .set({ name: input.name, filters: input.filters })
        .where(eq(decks.id, input.id))
        .returning();

      const result = results[0];

      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(SelectDecksSchema)
    .mutation(async ({ input }) => {
      const { id } = input;

      const results = await db
        .delete(decks)
        .where(eq(decks.id, id))
        .returning();

      const result = results[0];

      return result;
    }),
});
