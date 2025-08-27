import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../db";
import { z } from "zod";
import { migrations, SelectMigrationsSchema } from "../db/schema/migrations";
import { desc, gt } from "drizzle-orm";

export const migrationsRouter = router({
  /**
   * Register a new migration that will be
   * pulled by all clients and applied to
   * the local schemas.
   */
  registerSchema: adminProcedure
    .input(z.object({ sqlScript: z.string(), description: z.string() }))
    .output(SelectMigrationsSchema)
    .mutation(async ({ input: { sqlScript, description } }) => {
      const results = await db
        .insert(migrations)
        .values({ sql_script: sqlScript, description })
        .returning();

      const migration = results[0];

      return migration;
    }),

  /**
   * Get the latest schema version.
   */
  currentVersion: protectedProcedure
    .output(SelectMigrationsSchema.shape.version)
    .query(async () => {
      const results = await db
        .select({ version: migrations.version })
        .from(migrations)
        .orderBy(desc(migrations.version))
        .limit(1);

      return results[0].version;
    }),

  /**
   * Verify the schema version against the current version.
   * If an upate is required, returns the required migrations.
   *
   * Clients should apply each of these migrations locally.
   */
  verifySchema: protectedProcedure
    .input(z.object({ version: z.number() }))
    .output(
      z.object({
        status: z.enum(["latest", "update_required"]),
        currentVersion: z.number(),
        clientVersion: z.number(),
        requiredMigrations: z.array(SelectMigrationsSchema).optional(),
      }),
    )
    .query(async ({ input }) => {
      const requiredMigrations = await db
        .select()
        .from(migrations)
        .where(gt(migrations.version, input.version))
        .orderBy(desc(migrations.version));

      if (requiredMigrations.length > 0) {
        return {
          status: "update_required",
          currentVersion: requiredMigrations[0].version,
          clientVersion: input.version,
          requiredMigrations,
        };
      }

      return {
        status: "latest",
        currentVersion: input.version,
        clientVersion: input.version,
      };
    }),

  fullSchema: protectedProcedure
    .output(z.array(SelectMigrationsSchema))
    .query(async () => {
      const results = await db.select().from(migrations);

      return results;
    }),
});
