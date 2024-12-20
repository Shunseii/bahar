import { router, protectedProcedure } from "../trpc";
import {
  SelectSettingsSchema,
  settings,
  InsertSettingsSchema,
} from "../db/schema/settings";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const settingsRouter = router({
  get: protectedProcedure
    .output(SelectSettingsSchema.nullable())
    .query(async ({ ctx }) => {
      const { user } = ctx;

      // There is only one setting per user
      const results = await db
        .select()
        .from(settings)
        .where(eq(settings.user_id, user.id))
        .limit(1);

      return results[0] ?? null;
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

      return results[0];
    }),
});
