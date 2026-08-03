import {
  type CardLayout,
  CardLayoutSchema,
  type InsertSetting,
  type SelectSetting,
  settings,
} from "@bahar/drizzle-user-db-schemas";
import { nanoid } from "nanoid/non-secure";
import { enqueueDbOperation } from "../queue";
import type { TableOperation } from "../types";
import type { OperationDeps } from "./deps";

/**
 * A layout that fails to parse is treated as absent rather than thrown on: the
 * column is synced between clients, so a malformed payload must degrade to the
 * defaults instead of breaking review.
 */
const parseCardLayout = (value: CardLayout | null): CardLayout | null => {
  if (!value) return null;

  const parsed = CardLayoutSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
};

export const makeSettingsTable = ({
  enqueue = enqueueDbOperation,
  getDb,
}: OperationDeps) =>
  ({
    getSettings: {
      query: async (): Promise<Omit<SelectSetting, "id">> => {
        const drizzleDb = await getDb();

        const [res] = await drizzleDb.select().from(settings).limit(1);

        if (!res) {
          await enqueue(() =>
            drizzleDb.insert(settings).values({
              id: nanoid(),
              show_antonyms_in_flashcard: "hidden",
              create_reverse_by_default: false,
              card_layout: null,
            })
          );
          return {
            show_antonyms_in_flashcard: "hidden",
            create_reverse_by_default: false,
            card_layout: null,
          };
        }

        return {
          show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
          create_reverse_by_default: res.create_reverse_by_default,
          card_layout: parseCardLayout(res.card_layout),
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
        enqueue(async () => {
          const drizzleDb = await getDb();

          const setValues: Partial<InsertSetting> = {};

          if (
            "show_antonyms_in_flashcard" in updates &&
            updates.show_antonyms_in_flashcard !== undefined
          ) {
            setValues.show_antonyms_in_flashcard =
              updates.show_antonyms_in_flashcard;
          }
          if (
            "create_reverse_by_default" in updates &&
            updates.create_reverse_by_default !== undefined
          ) {
            setValues.create_reverse_by_default =
              updates.create_reverse_by_default;
          }
          // Null is a meaningful value here -- it resets the card back to the
          // default layout -- so it passes through where `undefined` does not.
          if ("card_layout" in updates && updates.card_layout !== undefined) {
            setValues.card_layout = updates.card_layout;
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
            create_reverse_by_default: res.create_reverse_by_default,
            card_layout: parseCardLayout(res.card_layout),
          };
        }),
      cacheOptions: {
        queryKey: ["turso.settings.update"],
      },
    },
  }) satisfies Record<string, TableOperation>;
