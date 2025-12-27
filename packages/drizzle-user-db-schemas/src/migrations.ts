import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { MIGRATION_STATUSES } from "./types";

/**
 * Migrations table for user database.
 * Tracks which migrations have been applied to each client database.
 */
export const migrations = sqliteTable("migrations", {
  version: integer("version").primaryKey().notNull(),
  description: text("description").notNull(),
  applied_at_ms: integer("applied_at_ms").notNull(),
  status: text("status", { enum: MIGRATION_STATUSES })
    .notNull()
    .default("applied"),
});

export type SelectMigration = typeof migrations.$inferSelect;
export type InsertMigration = typeof migrations.$inferInsert;
