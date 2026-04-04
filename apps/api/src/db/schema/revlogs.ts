import { FLASHCARD_DIRECTIONS } from "@bahar/drizzle-user-db-schemas";
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";

/**
 * The source of the revlog. Review refers to a manual
 * review by the user. Clear backlog refers to a bulk reset
 * with the clear backlog button.
 *
 * Typically we want to exclude the latter from most
 * statistics.
 */
export const REVLOG_SOURCES = ["review", "clear_backlog"] as const;

export const REVLOG_RATINGS = [
  "again",
  "hard",
  "good",
  "easy",
  "manual",
] as const;

export const revlogs = sqliteTable("revlogs", {
  id: text("id").primaryKey().notNull(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),

  difficulty: real("difficulty").default(0),
  due: text("due").notNull(),
  due_timestamp_ms: integer("due_timestamp_ms").notNull(),
  review: text("review").notNull(),
  review_timestamp_ms: integer("review_timestamp_ms").notNull(),
  learning_steps: integer("learning_steps").default(0),
  scheduled_days: integer("scheduled_days").default(0),
  stability: real("stability").default(0),
  state: integer("state").default(0),

  rating: text("rating", { enum: REVLOG_RATINGS }),

  direction: text("direction", { enum: FLASHCARD_DIRECTIONS })
    .notNull()
    .default("forward"),

  source: text("source", { enum: REVLOG_SOURCES }).notNull().default("review"),

  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Revlogs = typeof revlogs.$inferSelect;
export type InsertRevlogs = typeof revlogs.$inferInsert;

export const InsertRevlogsSchema = createInsertSchema(revlogs);
export const SelectRevlogsSchema = createSelectSchema(revlogs);
