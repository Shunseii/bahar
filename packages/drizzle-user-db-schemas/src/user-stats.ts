import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userStats = sqliteTable("user_stats", {
  id: text("id").primaryKey().notNull(),
  streak_count: integer("streak_count").default(0),
  longest_streak: integer("longest_streak").default(0),
  last_review_date: text("last_review_date"),
});

export type SelectUserStats = typeof userStats.$inferSelect;
export type InsertUserStats = typeof userStats.$inferInsert;
