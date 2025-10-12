import { router, protectedProcedure } from "../trpc";
import {
  SelectSettingsSchema,
  settings,
  InsertSettingsSchema,
} from "../db/schema/settings";
import { db } from "../db";
import { nanoid } from "nanoid";
import { getUserDbClient } from "../clients/turso";
import { LogCategory, logger } from "../utils/logger";

export const settingsRouter = router({
  get: protectedProcedure
    .output(SelectSettingsSchema.nullable())
    .query(async ({ ctx }) => {
      const { user } = ctx;

      const userDbClient = await getUserDbClient(user.id);

      if (!userDbClient) {
        return null;
      }

      const result = await userDbClient.execute(
        "SELECT id, show_reverse_flashcards, show_antonyms_in_flashcard FROM settings LIMIT 1",
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id as string,
        user_id: user.id,
        show_reverse_flashcards: Boolean(row.show_reverse_flashcards),
        show_antonyms_in_flashcard: row.show_antonyms_in_flashcard as
          | "hidden"
          | "answer"
          | "hint",
      };
    }),

  update: protectedProcedure
    .input(InsertSettingsSchema.omit({ id: true, user_id: true }))
    .output(SelectSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const results = await db
        .insert(settings)
        .values({ id: nanoid(), user_id: user.id, ...input })
        .onConflictDoUpdate({ target: settings.user_id, set: { ...input } })
        .returning();

      const result = results[0];

      try {
        const userDbClient = await getUserDbClient(user.id);

        if (userDbClient) {
          await userDbClient.execute({
            sql: `INSERT INTO settings (id, show_reverse_flashcards, show_antonyms_in_flashcard)
                  VALUES (?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    show_reverse_flashcards = excluded.show_reverse_flashcards,
                    show_antonyms_in_flashcard = excluded.show_antonyms_in_flashcard`,
            args: [
              result.id,
              result.show_reverse_flashcards ? 1 : 0,
              result.show_antonyms_in_flashcard,
            ],
          });

          logger.info(
            {
              userId: user.id,
              category: LogCategory.DATABASE,
              event: "settings.dual_write.success",
            },
            "Successfully wrote settings to user DB",
          );
        }
      } catch (err) {
        logger.error(
          {
            err,
            userId: user.id,
            category: LogCategory.DATABASE,
            event: "settings.dual_write.error",
          },
          "Failed to write settings to user DB",
        );
      }

      return result;
    }),
});
