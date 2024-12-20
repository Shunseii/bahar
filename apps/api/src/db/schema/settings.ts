import { text, sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";

export const settings = sqliteTable("settings", {
  id: text("id").notNull().primaryKey(),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  show_reverse_flashcards: integer("show_reverse_flashcards", {
    mode: "boolean",
  }).default(false),
  show_antonyms_in_flashcard: text("show_antonyms_in_flashcard", {
    enum: ["hidden", "answer", "hint"],
  }).default("hidden"),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

export const InsertSettingsSchema = createInsertSchema(settings);
export const SelectSettingsSchema = createSelectSchema(settings);
