import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import {
  createUserAccessToken,
  READ_ONLY_TOKEN_EXPIRATION,
} from "../clients/turso";
import { db } from "../db";
import { databases } from "../db/schema/databases";
import { betterAuthGuard } from "../middleware";
import { isJwtExpiringSoon } from "../utils";

/**
 * Header better-auth's apiKey plugin reads a key from. A request carrying one
 * authenticated as an API key rather than as a signed-in app session.
 */
const API_KEY_HEADER = "x-api-key";

export const databasesRouter = new Elysia({ prefix: "/databases" })
  .use(betterAuthGuard)
  .get(
    "/user",
    async ({ user, status, request }) => {
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

      // API-key callers (the CLI, and agents driving it) get a read-only
      // token: they read the database directly but make every change through
      // the dictionary endpoints, so a leaked key can't corrupt data with raw
      // SQL. App sessions still get the full-access token they sync with.
      if (request.headers.get(API_KEY_HEADER)) {
        const readOnlyToken = await createUserAccessToken({
          dbName: userDb.db_name,
          authorization: "read-only",
          expiration: READ_ONLY_TOKEN_EXPIRATION,
        });

        return {
          ...userDb,
          access_token: readOnlyToken.jwt,
          access_level: "read_only" as const,
        };
      }

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

        return {
          ...userDb,
          access_token: newToken.jwt,
          access_level: "full" as const,
        };
      }

      return { ...userDb, access_level: "full" as const };
    },
    { auth: "user" }
  );
