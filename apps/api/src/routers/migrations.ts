import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../db";
import { z } from "zod";
import { migrations, SelectMigrationsSchema } from "../db/schema/migrations";
import { asc, desc, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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

      if (results.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to register schema",
        });
      }

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

      // When no migrations exist in the database.
      // Ideally this should never happen.
      if (results.length === 0) {
        return 0;
      }

      return results[0].version;
    }),

  /**
   * Verify the schema version against the current version.
   * If an update is required, returns the required migrations.
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
        // TODO: Using the SelectMigrationsSchema results in ts not being
        // able to infer the type on the client and just types as any.
        // requiredMigrations: z.array(SelectMigrationsSchema).optional(),
        requiredMigrations: z
          .array(
            z.object({
              version: z.number(),
              description: z.string(),
              sql_script: z.string(),
              // TODO: specifically, z.date() breaks the type inference.
              // created_at: z.date(),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const requiredMigrations = await db
        .select()
        .from(migrations)
        .where(gt(migrations.version, input.version))
        .orderBy(asc(migrations.version));

      if (requiredMigrations.length > 0) {
        const currentVersion =
          requiredMigrations[requiredMigrations.length - 1].version;

        return {
          status: "update_required",
          currentVersion,
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
    .output(
      z.array(
        z.object({
          version: z.number(),
          description: z.string(),
          sql_script: z.string(),
          // TODO: specifically, z.date() breaks the type inference.
          // created_at: z.date(),
        }),
      ),
    )
    .query(async () => {
      const results = await db.select().from(migrations);

      return results;
    }),
});
