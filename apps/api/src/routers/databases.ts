import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { databases, SelectDatabasesSchema } from "../db/schema/databases";
import { tursoClient } from "../clients/turso";
import { isJwtExpired } from "../utils";
import { TRPCError } from "@trpc/server";

export const databasesRouter = router({
  /**
   * Returns the connection information
   * and access token for the current
   * user's database.
   */
  userDatabase: protectedProcedure
    .output(SelectDatabasesSchema)
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      const results = await db
        .select()
        .from(databases)
        .where(eq(databases.user_id, userId))
        .limit(1);

      if (!results[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No database found for user",
        });
      }

      return results[0];
    }),

  /**
   * Returns the connection information
   * and access token for the current
   * user's database. If the access token is
   * expired, it will refresh it.
   */
  refreshUserToken: protectedProcedure
    .output(SelectDatabasesSchema)
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const results = await db
        .select()
        .from(databases)
        .where(eq(databases.user_id, userId))
        .limit(1);

      if (!results[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No database found for user",
        });
      }

      const userDb = results[0];

      if (userDb?.access_token && isJwtExpired(userDb.access_token)) {
        const newToken = await tursoClient.databases.createToken(
          userDb.db_name,
        );

        await db
          .update(databases)
          .set({ access_token: newToken.jwt })
          .where(eq(databases.id, userDb.id));

        return { ...userDb, access_token: newToken.jwt };
      }

      return userDb;
    }),
});
