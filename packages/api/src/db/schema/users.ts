import { text, integer, index, sqliteTable } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").notNull().primaryKey(),
    email: text("email").notNull().unique(),
    username: text("username").notNull(),
    github_id: integer("github_id").unique(),
  },
  (table) => {
    return {
      username: index("username_idx").on(table.username),
    };
  },
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
