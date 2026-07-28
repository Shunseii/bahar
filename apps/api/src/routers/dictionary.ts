import { nullToUndefined } from "@bahar/db-operations";
import {
  type FLASHCARD_DIRECTIONS,
  WordInputSchema,
  WordUpdatesSchema,
} from "@bahar/drizzle-user-db-schemas";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { type Grade, Rating, type ReviewLog } from "ts-fsrs";
import { z } from "zod";
import { db } from "../db";
import { revlogs } from "../db/schema/revlogs";
import { getUserOperations } from "../db/user-db";
import { betterAuthGuard } from "../middleware";

/**
 * Grades as the API accepts them: the rating label rather than ts-fsrs'
 * numeric `Rating`, so a caller never has to know the enum's values.
 */
const GRADE_LABELS = ["again", "hard", "good", "easy"] as const;

const GRADE_BY_LABEL: Record<(typeof GRADE_LABELS)[number], Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const LABEL_BY_GRADE: Record<Grade, (typeof GRADE_LABELS)[number]> = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
};

/**
 * True for the "no row with that id" error the entry mutations throw. Those
 * ids are reported per item instead of failing the whole request, so one stale
 * id in a batch doesn't discard the rest.
 */
const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.startsWith("Dictionary entry not found");

/**
 * Serializes an FSRS review log into a central-database revlog row. Mirrors
 * what the apps post to /stats/revlogs: review history lives in the central
 * DB, not the user's, so grading writes it here.
 */
const toRevlogValues = ({
  log,
  direction,
  dictionaryEntryId,
  userId,
}: {
  log: ReviewLog;
  direction: (typeof FLASHCARD_DIRECTIONS)[number];
  dictionaryEntryId: string;
  userId: string;
}) => ({
  id: nanoid(),
  user_id: userId,
  dictionary_entry_id: dictionaryEntryId,
  difficulty: log.difficulty,
  due: log.due.toISOString(),
  due_timestamp_ms: log.due.getTime(),
  review: log.review.toISOString(),
  review_timestamp_ms: log.review.getTime(),
  learning_steps: log.learning_steps,
  scheduled_days: log.scheduled_days,
  stability: log.stability,
  state: log.state,
  rating: LABEL_BY_GRADE[log.rating as Grade],
  direction,
  source: "review" as const,
});

const NO_DATABASE_RESPONSE = { message: "No database found for user" } as const;

/**
 * Write endpoints for the user's dictionary, so a client that can't (or
 * shouldn't) hold a read-write database token -- the CLI, and agents driving
 * it -- can still make validated changes. Reads stay direct-to-database.
 *
 * Every handler runs the same `@bahar/db-operations` mutations the web and
 * mobile apps run, against the user's remote database rather than a local
 * replica. Writes therefore land immediately on the remote and show up in an
 * open app only after its next sync pull (~60s).
 *
 * All four endpoints take batches, matching the CLI commands they back. Ids
 * that don't resolve come back in `missing` rather than failing the request.
 */
export const dictionaryRouter = new Elysia({
  prefix: "/dictionary",
  tags: ["dictionary"],
})
  .use(betterAuthGuard)
  .post(
    "/entries",
    async ({ user, body, status }) => {
      const operations = await getUserOperations(user.id);

      if (!operations) {
        return status(404, NO_DATABASE_RESPONSE);
      }

      try {
        const added = [];

        for (const word of body.words) {
          const { entry, forward, reverse } =
            await operations.dictionaryEntriesTable.addWordWithFlashcards.mutation(
              {
                // The payload allows an explicit null for an optional field;
                // the mutation takes the undefined form of the same thing.
                word: nullToUndefined(word),
                createReverse: body.createReverse,
              }
            );

          added.push({
            id: entry.id,
            word: entry.word,
            flashcardIds: {
              forward: forward.id,
              reverse: reverse?.id ?? null,
            },
          });
        }

        return { added };
      } finally {
        operations.client.close();
      }
    },
    {
      auth: "user",
      body: z.object({
        words: z.array(WordInputSchema).min(1),
        /**
         * Per-request override of the account's `create_reverse_by_default`
         * setting, matching the add-word form's per-word switch.
         */
        createReverse: z.boolean().optional(),
      }),
    }
  )
  .patch(
    "/entries",
    async ({ user, body, status }) => {
      const operations = await getUserOperations(user.id);

      if (!operations) {
        return status(404, NO_DATABASE_RESPONSE);
      }

      try {
        const edited: { id: string; word: string; updated: string[] }[] = [];
        const missing: string[] = [];

        for (const { id, updates } of body.edits) {
          try {
            const entry =
              await operations.dictionaryEntriesTable.editWord.mutation({
                id,
                updates,
              });

            edited.push({
              id: entry.id,
              word: entry.word,
              updated: Object.keys(updates),
            });
          } catch (error) {
            if (!isNotFoundError(error)) throw error;

            missing.push(id);
          }
        }

        return { edited, missing };
      } finally {
        operations.client.close();
      }
    },
    {
      auth: "user",
      body: z.object({
        edits: z
          .array(
            z.object({
              id: z.string().min(1),
              updates: WordUpdatesSchema,
            })
          )
          .min(1),
      }),
    }
  )
  .delete(
    "/entries",
    async ({ user, body, status }) => {
      const operations = await getUserOperations(user.id);

      if (!operations) {
        return status(404, NO_DATABASE_RESPONSE);
      }

      try {
        const deleted: { id: string; word: string }[] = [];
        const missing: string[] = [];

        for (const id of body.ids) {
          try {
            // Deletes the entry's flashcards too -- sync-wasm doesn't support
            // ON DELETE CASCADE, so the operation does it explicitly.
            const entry =
              await operations.dictionaryEntriesTable.delete.mutation({ id });

            deleted.push({ id: entry.id, word: entry.word });
          } catch (error) {
            if (!isNotFoundError(error)) throw error;

            missing.push(id);
          }
        }

        return { deleted, missing };
      } finally {
        operations.client.close();
      }
    },
    {
      auth: "user",
      body: z.object({ ids: z.array(z.string().min(1)).min(1) }),
    }
  )
  .post(
    "/flashcards/grade",
    async ({ user, body, status }) => {
      const operations = await getUserOperations(user.id);

      if (!operations) {
        return status(404, NO_DATABASE_RESPONSE);
      }

      try {
        const { graded, missing } =
          await operations.flashcardsTable.grade.mutation({
            grades: body.grades.map(({ id, grade }) => ({
              id,
              grade: GRADE_BY_LABEL[grade],
            })),
            timezone: body.timezone,
          });

        if (graded.length > 0) {
          await db.insert(revlogs).values(
            graded.map(({ log, direction, dictionary_entry_id }) =>
              toRevlogValues({
                log,
                direction,
                dictionaryEntryId: dictionary_entry_id,
                userId: user.id,
              })
            )
          );
        }

        return {
          graded: graded.map(({ id, due, log }) => ({
            id,
            due,
            grade: LABEL_BY_GRADE[log.rating as Grade],
          })),
          missing,
        };
      } finally {
        operations.client.close();
      }
    },
    {
      auth: "user",
      body: z.object({
        grades: z
          .array(
            z.object({
              id: z.string().min(1),
              grade: z.enum(GRADE_LABELS),
            })
          )
          .min(1),
        /**
         * IANA timezone of the caller, used only to seed the streak's day
         * boundary the first time it's recorded. The server's own timezone
         * would otherwise stand in for the user's.
         */
        timezone: z.string().optional(),
      }),
    }
  );
