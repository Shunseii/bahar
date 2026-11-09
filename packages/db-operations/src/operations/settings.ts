import {
  type InsertSetting,
  type SelectSetting,
  settings,
} from "@bahar/drizzle-user-db-schemas";
import { nanoid } from "nanoid/non-secure";
import {
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  MAX_BACKLOG_THRESHOLD_DAYS,
  MIN_BACKLOG_THRESHOLD_DAYS,
} from "../constants";
import { enqueueDbOperation } from "../queue";
import type { TableOperation } from "../types";
import type { OperationDeps } from "./deps";

/**
 * Settings as the apps consume them: the backlog threshold is always a usable
 * number, with rows that predate the column falling back to the default.
 */
export type Settings = Omit<SelectSetting, "id" | "backlog_threshold_days"> & {
  backlog_threshold_days: number;
};

/** Bounds a user-entered threshold to whole days within the allowed range. */
export const clampBacklogThreshold = (days: number): number => {
  if (!Number.isFinite(days)) return DEFAULT_BACKLOG_THRESHOLD_DAYS;

  return Math.min(
    MAX_BACKLOG_THRESHOLD_DAYS,
    Math.max(MIN_BACKLOG_THRESHOLD_DAYS, Math.round(days))
  );
};

const toSettings = (row: SelectSetting): Settings => ({
  show_antonyms_in_flashcard: row.show_antonyms_in_flashcard,
  create_reverse_by_default: row.create_reverse_by_default,
  backlog_threshold_days:
    row.backlog_threshold_days === null
      ? DEFAULT_BACKLOG_THRESHOLD_DAYS
      : clampBacklogThreshold(row.backlog_threshold_days),
});

export const makeSettingsTable = ({
  enqueue = enqueueDbOperation,
  getDb,
}: OperationDeps) =>
  ({
    getSettings: {
      query: async (): Promise<Settings> => {
        const drizzleDb = await getDb();

        const [res] = await drizzleDb.select().from(settings).limit(1);

        if (!res) {
          await enqueue(() =>
            drizzleDb.insert(settings).values({
              id: nanoid(),
              show_antonyms_in_flashcard: "hidden",
              create_reverse_by_default: false,
            })
          );
          return {
            show_antonyms_in_flashcard: "hidden",
            create_reverse_by_default: false,
            backlog_threshold_days: DEFAULT_BACKLOG_THRESHOLD_DAYS,
          };
        }

        return toSettings(res);
      },
      cacheOptions: {
        queryKey: ["turso.settings.query"],
      },
    },
    update: {
      mutation: ({
        updates,
      }: {
        updates: Partial<Settings>;
      }): Promise<Settings> =>
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
          if (
            "backlog_threshold_days" in updates &&
            updates.backlog_threshold_days !== undefined
          ) {
            setValues.backlog_threshold_days = clampBacklogThreshold(
              updates.backlog_threshold_days
            );
          }

          if (Object.keys(setValues).length === 0) {
            throw new Error("No fields to update");
          }

          await drizzleDb.update(settings).set(setValues);

          const [res] = await drizzleDb.select().from(settings).limit(1);

          if (!res) {
            throw new Error("Settings not found");
          }

          return toSettings(res);
        }),
      cacheOptions: {
        queryKey: ["turso.settings.update"],
      },
    },
  }) satisfies Record<string, TableOperation>;
