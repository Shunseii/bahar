import { text, sqliteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";

export const databases = sqliteTable("databases", {
  id: text("id").notNull().primaryKey(),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  db_name: text("db_name").notNull(),
  hostname: text("hostname").notNull(),
  db_id: text("db_id").notNull(),
  access_token: text("access_token").notNull(),
});

export type Databases = typeof databases.$inferSelect;
export type InsertDatabases = typeof databases.$inferInsert;

export const InsertDatabasesSchema = createInsertSchema(databases);
export const SelectDatabasesSchema = createSelectSchema(databases);
