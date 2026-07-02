import {
  type InsertSetting,
  type SelectSetting,
  settings,
} from "@bahar/drizzle-user-db-schemas";
import { nanoid } from "nanoid";
import { ensureDb, getDrizzleDb } from "..";
import { enqueueDbOperation } from "../queue";
import type { TableOperation } from "./types";

export const settingsTable = {
  getSettings: {
    query: async (): Promise<Omit<SelectSetting, "id">> => {
      await ensureDb();
      const drizzleDb = getDrizzleDb();

      const [res] = await drizzleDb.select().from(settings).limit(1);

      if (!res) {
        await enqueueDbOperation(() =>
          drizzleDb.insert(settings).values({
            id: nanoid(),
            show_antonyms_in_flashcard: "hidden",
            show_reverse_flashcards: false,
          })
        );
        return {
          show_antonyms_in_flashcard: "hidden",
          show_reverse_flashcards: false,
        };
      }

      return {
        show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
        show_reverse_flashcards: res.show_reverse_flashcards,
      };
    },
    cacheOptions: {
      queryKey: ["turso.settings.query"],
    },
  },
  update: {
    mutation: ({
      updates,
    }: {
      updates: Partial<Omit<SelectSetting, "id">>;
    }): Promise<Omit<SelectSetting, "id">> =>
      enqueueDbOperation(async () => {
        await ensureDb();
        const drizzleDb = getDrizzleDb();

        const setValues: Partial<InsertSetting> = {};

        if (
          "show_antonyms_in_flashcard" in updates &&
          updates.show_antonyms_in_flashcard !== undefined
        ) {
          setValues.show_antonyms_in_flashcard =
            updates.show_antonyms_in_flashcard;
        }
        if (
          "show_reverse_flashcards" in updates &&
          updates.show_reverse_flashcards !== undefined
        ) {
          setValues.show_reverse_flashcards = updates.show_reverse_flashcards;
        }

        if (Object.keys(setValues).length === 0) {
          throw new Error("No fields to update");
        }

        await drizzleDb.update(settings).set(setValues);

        const [res] = await drizzleDb.select().from(settings).limit(1);

        if (!res) {
          throw new Error("Settings not found");
        }

        return {
          show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
          show_reverse_flashcards: res.show_reverse_flashcards,
        };
      }),
    cacheOptions: {
      queryKey: ["turso.settings.update"],
    },
  },
} satisfies Record<string, TableOperation>;
