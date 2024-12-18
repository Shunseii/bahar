import { db } from "../db/index";
import { users } from "../db/schema/auth";
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
        username: user.name,
      };
    }),

  list: publicProcedure.query(async () => {
    return db.select().from(users);
  }),
});
