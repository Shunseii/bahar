import { text, integer, index, sqliteTable } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").notNull().primaryKey(),
    name: text("name"),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    github_id: integer("github_id").unique(),
  },
  (table) => {
    return {
      nameIdx: index("name_idx").on(table.name),
    };
  },
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
