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
import { LogCategory, logger } from "../utils/logger";

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

      try {
        const userDbClient = await getUserDbClient(user.id);

        if (userDbClient) {
          await userDbClient.execute({
            sql: `INSERT INTO decks (id, name, filters) VALUES (?, ?, ?)`,
            args: [result.id, result.name, JSON.stringify(result.filters)],
          });

          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "decks.create.dual_write.success",
            },
            "Successfully wrote deck to user DB",
          );
        }
      } catch (err) {
        logger.error(
          {
            err,
            userId: user.id,
            category: LogCategory.DATABASE,
            event: "decks.create.dual_write.error",
          },
          "Failed to write deck to user DB",
        );
      }

      return result;
    }),

  update: protectedProcedure
    .input(InsertDecksSchema.pick({ id: true, name: true, filters: true }))
    .output(SelectDecksSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const results = await db
        .update(decks)
        .set({ name: input.name, filters: input.filters })
        .where(eq(decks.id, input.id))
        .returning();

      const result = results[0];

      try {
        const userDbClient = await getUserDbClient(user.id);

        if (userDbClient) {
          await userDbClient.execute({
            sql: `UPDATE decks SET name = ?, filters = ? WHERE id = ?`,
            args: [result.name, JSON.stringify(result.filters), result.id],
          });

          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "decks.update.dual_write.success",
            },
            "Successfully updated deck in user DB",
          );
        }
      } catch (err) {
        logger.error(
          {
            err,
            userId: user.id,
            category: LogCategory.DATABASE,
            event: "decks.update.dual_write.error",
          },
          "Failed to update deck in user DB",
        );
      }

      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(SelectDecksSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { id } = input;

      const results = await db
        .delete(decks)
        .where(eq(decks.id, id))
        .returning();

      const result = results[0];

      try {
        const userDbClient = await getUserDbClient(user.id);

        if (userDbClient) {
          await userDbClient.execute({
            sql: `DELETE FROM decks WHERE id = ?`,
            args: [id],
          });

          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "decks.delete.dual_write.success",
            },
            "Successfully deleted deck from user DB",
          );
        }
      } catch (err) {
        logger.error(
          {
            err,
            userId: user.id,
            category: LogCategory.DATABASE,
            event: "decks.delete.dual_write.error",
          },
          "Failed to delete deck from user DB",
        );
      }

      return result;
    }),
});
