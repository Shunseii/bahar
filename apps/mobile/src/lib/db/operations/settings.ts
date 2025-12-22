/**
 * Settings database operations for mobile app.
 */

import {
  SelectSetting,
  RawSetting,
  ShowAntonymsMode,
} from "@bahar/drizzle-user-db-schemas";
import { type TableOperation } from "@bahar/db-operations";
import { ensureDb } from "..";

const SETTINGS_ID = "default";

export interface UserSettings {
  show_antonyms_mode: ShowAntonymsMode;
  show_reverse_flashcards: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  show_antonyms_mode: "answer",
  show_reverse_flashcards: false,
};

/**
 * Convert raw settings row to typed settings.
 */
const toUserSettings = (raw: RawSetting | undefined): UserSettings => {
  if (!raw) return DEFAULT_SETTINGS;
  return {
    show_antonyms_mode: (raw.show_antonyms_in_flashcard as ShowAntonymsMode) ?? DEFAULT_SETTINGS.show_antonyms_mode,
    show_reverse_flashcards: Boolean(raw.show_reverse_flashcards),
  };
};

export const settingsTable = {
  get: {
    query: async (): Promise<UserSettings> => {
      const db = await ensureDb();

      const row = await db
        .prepare<RawSetting>(`SELECT * FROM settings WHERE id = ?;`)
        .get([SETTINGS_ID]);

      return toUserSettings(row);
    },
    cacheOptions: {
      queryKey: ["turso.settings.get"] as const,
      staleTime: 60 * 1000, // 1 minute
    },
  },

  update: {
    mutation: async ({
      updates,
    }: {
      updates: Partial<UserSettings>;
    }): Promise<UserSettings> => {
      const db = await ensureDb();

      // Get current settings
      const current = await settingsTable.get.query();
      const newSettings = { ...current, ...updates };

      // Upsert settings
      await db
        .prepare(
          `INSERT INTO settings (id, show_antonyms_in_flashcard, show_reverse_flashcards)
           VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             show_antonyms_in_flashcard = excluded.show_antonyms_in_flashcard,
             show_reverse_flashcards = excluded.show_reverse_flashcards;`,
        )
        .run([
          SETTINGS_ID,
          newSettings.show_antonyms_mode,
          newSettings.show_reverse_flashcards ? 1 : 0,
        ]);

      return newSettings;
    },
    cacheOptions: {
      queryKey: ["turso.settings.update"] as const,
    },
  },
} as const satisfies Record<string, TableOperation>;
