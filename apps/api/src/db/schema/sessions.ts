import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { users } from "./users.js";

export const sessions = sqliteTable("sessions", {
  id: text("id").notNull().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  fresh: integer("fresh", { mode: "boolean" }),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
