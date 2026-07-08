/**
 * Settings operations for mobile — thin wiring over the shared
 * @bahar/db-operations factory, adapted to mobile's existing public shape:
 * the `get` method name and the `show_antonyms_mode` field (the shared/DB
 * column is `show_antonyms_in_flashcard`; mobile's UI has always used the
 * `show_antonyms_mode` alias). Same underlying column and values.
 *
 * Note: the shared getSettings self-heals a missing row by inserting the
 * default ("hidden") and persisting it -- mobile previously returned an
 * in-memory default of "answer" without persisting. New/no-row users now
 * default to "hidden" (matching web). See BAH-151.
 */

import { makeSettingsTable } from "@bahar/db-operations";
import type { ShowAntonymsMode } from "@bahar/drizzle-user-db-schemas";
import { getDb } from "./get-db";

export interface UserSettings {
  show_antonyms_mode: ShowAntonymsMode;
  show_reverse_flashcards: boolean;
}

const base = makeSettingsTable({ getDb });

const toUserSettings = (s: {
  show_antonyms_in_flashcard: ShowAntonymsMode | null;
  show_reverse_flashcards: boolean | null;
}): UserSettings => ({
  show_antonyms_mode: s.show_antonyms_in_flashcard ?? "hidden",
  show_reverse_flashcards: s.show_reverse_flashcards ?? false,
});

export const settingsTable = {
  get: {
    query: async (): Promise<UserSettings> =>
      toUserSettings(await base.getSettings.query()),
    cacheOptions: base.getSettings.cacheOptions,
  },
  update: {
    mutation: async ({
      updates,
    }: {
      updates: Partial<UserSettings>;
    }): Promise<UserSettings> => {
      const mapped: Partial<{
        show_antonyms_in_flashcard: ShowAntonymsMode;
        show_reverse_flashcards: boolean;
      }> = {};
      if (updates.show_antonyms_mode !== undefined) {
        mapped.show_antonyms_in_flashcard = updates.show_antonyms_mode;
      }
      if (updates.show_reverse_flashcards !== undefined) {
        mapped.show_reverse_flashcards = updates.show_reverse_flashcards;
      }
      return toUserSettings(await base.update.mutation({ updates: mapped }));
    },
    cacheOptions: base.update.cacheOptions,
  },
};
