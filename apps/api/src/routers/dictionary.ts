import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const userRouter = router({
  import: publicProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return true;
    }),
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
});
