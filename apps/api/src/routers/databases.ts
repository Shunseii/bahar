import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { databases, SelectDatabasesSchema } from "../db/schema/databases";
import { tursoClient } from "../clients/turso";
import { isJwtExpired } from "../utils";

export const databasesRouter = router({
  userDatabase: protectedProcedure
    .output(SelectDatabasesSchema)
    .query(async ({ ctx }) => {
      const {
        user: { id },
      } = ctx;

      const results = await db
        .select()
        .from(databases)
        .where(eq(databases.user_id, id))
        .limit(1);

      const userDb = results[0];

      if (userDb?.access_token && !isJwtExpired(userDb.access_token)) {
        const newToken = await tursoClient.databases.createToken(
          userDb.db_name,
        );

        await db
          .update(databases)
          .set({ access_token: newToken.jwt })
          .where(eq(databases.id, userDb.id));

        return {
          ...userDb,
          access_token: newToken.jwt,
        };
      }

      return userDb;
    }),
});
