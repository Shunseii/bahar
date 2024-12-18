import { text, sqliteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";
import { z } from "zod";

export const decks = sqliteTable("decks", {
  id: text("id").notNull().primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  filters: text("filters", { mode: "json" }).$type<{
    tags?: string[];
    state?: (0 | 1 | 2 | 3)[];
    types?: ("ism" | "fi'l" | "harf" | "expression")[];
  }>(),
});

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = typeof decks.$inferInsert;

export const FilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  state: z
    .array(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]))
    .optional(),
  types: z.array(z.enum(["ism", "fi'l", "harf", "expression"])).optional(),
});

export const InsertDecksSchema = createInsertSchema(decks, {
  filters: FilterSchema,
});
export const SelectDecksSchema = createSelectSchema(decks, {
  filters: FilterSchema,
});
