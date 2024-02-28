import { db } from "../db";
import { users } from "../db/schema/users";
import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const userRouter = router({
  me: publicProcedure
    .output(
      z.nullable(
        z.object({
          id: z.string(),
          username: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const { user, session } = ctx;

      if (!session || !user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
      };
    }),

  list: publicProcedure.query(async () => {
    return db.select().from(users);
  }),
});
