import { router, protectedProcedure } from "../trpc";
import {
  SelectSettingsSchema,
  settings,
  InsertSettingsSchema,
} from "../db/schema/settings";
import { db } from "../db";
import { nanoid } from "nanoid";
import { getUserDbClient } from "../clients/turso";

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

      return result;
    }),
});
