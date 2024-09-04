import { text, sqliteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./users";
import { z } from "zod";

export const decks = sqliteTable("decks", {
  id: text("id").notNull().primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  filters: text("filters", { mode: "json" }).$type<{
    tags?: string[];
    types?: ("ism" | "fi'l" | "harf" | "expression")[];
  }>(),
});

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;

export const FilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  types: z.array(z.enum(["ism", "fi'l", "harf", "expression"])).optional(),
});

export const InsertDecksSchema = createInsertSchema(decks, {
  filters: FilterSchema,
});
export const SelectDecksSchema = createSelectSchema(decks, {
  filters: FilterSchema,
});
