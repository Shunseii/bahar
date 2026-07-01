import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/db";
import { migrations } from "../src/db/schema/migrations";
import { logger } from "../src/utils/logger";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../packages/drizzle-user-db-schemas/drizzle", import.meta.url)
);
const BREAKPOINT_MARKER = "--> statement-breakpoint";

/**
 * Registers each per-user-db drizzle migration
 * (packages/drizzle-user-db-schemas/drizzle/*.sql) into the central
 * `migrations` table, so `setUpUserDb`/`applyAllNewMigrations` can apply
 * them to per-user Turso databases. Safe to re-run — skips files that are
 * already registered (matched by filename).
 */
const registerSchemaMigrations = async () => {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  logger.info(`Found ${files.length} migration file(s) in ${MIGRATIONS_DIR}.`);

  const existing = await db
    .select({ description: migrations.description })
    .from(migrations);
  const registeredDescriptions = new Set(
    existing.map((row) => row.description)
  );

  for (const file of files) {
    const description = file.replace(/\.sql$/, "");

    if (registeredDescriptions.has(description)) {
      logger.info({ description }, "Already registered, skipping.");
      continue;
    }

    const rawSql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
    const sqlScript = rawSql.split(BREAKPOINT_MARKER).join("\n");

    await db.insert(migrations).values({ description, sql_script: sqlScript });

    logger.info({ description }, "Registered migration.");
  }

  logger.info("Done.");
};

(async () => {
  try {
    await registerSchemaMigrations();
    process.exit(0);
  } catch (error) {
    logger.error(error, "Failed to register schema migrations");
    process.exit(1);
  }
})();
