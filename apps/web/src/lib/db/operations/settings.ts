import type { RawSetting, SelectSetting } from "@bahar/drizzle-user-db-schemas";
import { nanoid } from "nanoid";
import { ensureDb } from "..";
import type { TableOperation } from "./types";

export const settingsTable = {
  getSettings: {
    query: async (): Promise<Omit<SelectSetting, "id">> => {
      try {
        const db = await ensureDb();
        const res: RawSetting | undefined = await db
          .prepare("SELECT * FROM settings")
          .get();

        if (!res) {
          await db
            .prepare(
              "INSERT INTO settings (id, show_antonyms_in_flashcard, show_reverse_flashcards) VALUES (?, ?, ?)"
            )
            .run([nanoid(), "hidden", 0]);
          return {
            show_antonyms_in_flashcard: "hidden",
            show_reverse_flashcards: false,
          };
        }

        return {
          show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
          show_reverse_flashcards: Boolean(res.show_reverse_flashcards),
        };
      } catch (err) {
        console.error("Error in settingsTable.getSettings", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.settings.query"],
    },
  },
  update: {
    mutation: async ({
      updates,
    }: {
      updates: Partial<Omit<SelectSetting, "id">>;
    }): Promise<Omit<SelectSetting, "id">> => {
      try {
        const db = await ensureDb();

        const setClauses: string[] = [];
        const params: unknown[] = [];

        if (
          "show_antonyms_in_flashcard" in updates &&
          updates.show_antonyms_in_flashcard !== undefined
        ) {
          setClauses.push("show_antonyms_in_flashcard = ?");
          params.push(updates.show_antonyms_in_flashcard);
        }
        if (
          "show_reverse_flashcards" in updates &&
          updates.show_reverse_flashcards !== undefined
        ) {
          setClauses.push("show_reverse_flashcards = ?");
          params.push(updates.show_reverse_flashcards ? 1 : 0);
        }

        if (setClauses.length === 0) {
          throw new Error("No fields to update");
        }

        await db
          .prepare(`UPDATE settings SET ${setClauses.join(", ")};`)
          .run(params);

        const res: RawSetting = await db
          .prepare("SELECT * FROM settings")
          .get();

        return {
          show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
          show_reverse_flashcards: Boolean(res.show_reverse_flashcards),
        };
      } catch (err) {
        console.error("Error in settingsTable.update", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.settings.update"],
    },
  },
} satisfies Record<string, TableOperation>;
