import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { createUserAccessToken } from "../clients/turso";
import { db } from "../db";
import { databases } from "../db/schema/databases";
import { betterAuthGuard } from "../middleware";
import { isJwtExpiringSoon } from "../utils";

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

      const userDb = results[0];

      if (
        userDb?.access_token &&
        isJwtExpiringSoon({ token: userDb.access_token })
      ) {
        const newToken = await createUserAccessToken({
          dbName: userDb.db_name,
        });

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
