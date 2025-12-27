import { asc, desc, gt } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { db } from "../db";
import { migrations } from "../db/schema/migrations";
import { betterAuthGuard } from "../middleware";

export const migrationsRouter = new Elysia({ prefix: "/migrations" })
  .use(betterAuthGuard)
  .post(
    "/register",
    async ({ body, status }) => {
      const results = await db
        .insert(migrations)
        .values({ sql_script: body.sqlScript, description: body.description })
        .returning();

      if (results.length === 0) {
        return status(400, "Failed to register schema");
      }

      return results[0];
    },
    {
      auth: "admin",
      body: z.object({
        sqlScript: z.string(),
        description: z.string(),
      }),
    }
  )
  .get(
    "/current-version",
    async () => {
      const results = await db
        .select({ version: migrations.version })
        .from(migrations)
        .orderBy(desc(migrations.version))
        .limit(1);

      if (results.length === 0) {
        return { version: 0 };
      }

      return { version: results[0].version };
    },
    { auth: "user" }
  )
  .post(
    "/verify",
    async ({ body }) => {
      const requiredMigrations = await db
        .select()
        .from(migrations)
        .where(gt(migrations.version, body.version))
        .orderBy(asc(migrations.version));

      if (requiredMigrations.length > 0) {
        const currentVersion =
          requiredMigrations[requiredMigrations.length - 1].version;

        return {
          status: "update_required" as const,
          currentVersion,
          clientVersion: body.version,
          requiredMigrations,
        };
      }

      return {
        status: "latest" as const,
        currentVersion: body.version,
        clientVersion: body.version,
      };
    },
    {
      auth: "user",
      body: z.object({
        version: z.number(),
      }),
    }
  )
  .get(
    "/full",
    async () => {
      const results = await db.select().from(migrations);

      return results;
    },
    { auth: "user" }
  );
