import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const migrations = sqliteTable("migrations", {
  version: integer("version").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  sql_script: text("sql_script").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Migrations = typeof migrations.$inferSelect;
export type InsertMigrations = typeof migrations.$inferInsert;

export const InsertMigrationsSchema = createInsertSchema(migrations);
export const SelectMigrationsSchema = createSelectSchema(migrations);
