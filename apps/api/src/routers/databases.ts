import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { tursoPlatformClient } from "../clients/turso";
import { db } from "../db";
import { databases } from "../db/schema/databases";
import { betterAuthGuard } from "../middleware";
import { isJwtExpired } from "../utils";

export const databasesRouter = new Elysia({ prefix: "/databases" })
  .use(betterAuthGuard)
  .get(
    "/user",
    async ({ user, status }) => {
      const userId = user.id;

      const results = await db
        .select()
        .from(databases)
        .where(eq(databases.user_id, userId))
        .limit(1);

      if (!results[0]) {
        return status(404, { message: "No database found for user" });
      }

      return results[0];
    },
    { auth: "user" }
  )
  .post(
    "/refresh-token",
    async ({ user, status }) => {
      const userId = user.id;

      const results = await db
        .select()
        .from(databases)
        .where(eq(databases.user_id, userId))
        .limit(1);

      if (!results[0]) {
        return status(404, { message: "No database found for user" });
      }

      const userDb = results[0];

      if (userDb?.access_token && isJwtExpired(userDb.access_token)) {
        const newToken = await tursoPlatformClient.databases.createToken(
          userDb.db_name
        );

        await db
          .update(databases)
          .set({ access_token: newToken.jwt })
          .where(eq(databases.id, userDb.id));

        return { ...userDb, access_token: newToken.jwt };
      }

      return userDb;
    },
    { auth: "user" }
  );
