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
import { queryFlashcards } from "./flashcard";

export const decksRouter = router({
  list: protectedProcedure
    .output(
      z
        .array(
          SelectDecksSchema.extend({
            to_review: z.number(),
          }),
        )
        .optional(),
    )
    .query(async ({ ctx }) => {
      const { user } = ctx;

      const results = await db
        .select()
        .from(decks)
        .where(eq(decks.user_id, user.id))
        .limit(20);

      return await Promise.all(
        results.map(async (result) => {
          const filters = result.filters;

          const flashcards = await queryFlashcards({
            user_id: user.id,
            fields: ["id"],
            show_only_today: true,
            input: filters ? { filters } : undefined,
          });

          return {
            ...result,
            to_review: flashcards.length,
          };
        }),
      );
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

      return results[0];
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

      return results[0];
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

      return results[0];
    }),
});
