import express, {
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { nanoid } from "nanoid";
import { router, protectedProcedure } from "../trpc";
import multer from "multer";
import { meilisearchClient } from "../clients/meilisearch";
import { auth } from "../middleware";
import {
  ErrorCode,
  ImportErrorCode,
  ImportResponseError,
  MeilisearchError,
} from "../utils/error";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DictionarySchema } from "../schemas/dictionary.schema";
import { WordsSchema } from "../schemas/words.schema";
import { getUserDbClient } from "../clients/turso";
import { createEmptyCard } from "ts-fsrs";
import { batchIterator } from "../utils";

// TODO: resolve this dynamically from the json schema
export const JSON_SCHEMA_FIELDS = [
  "id",
  "word",
  "definition",
  "translation",
  "type",
  "root",
  "tags",
  "antonyms",
  "examples",
  "morphology",
  "created_at",
  "created_at_timestamp",
  "updated_at",
  "updated_at_timestamp",
  "flashcard",
  "flashcard_reverse",
];

export enum Inflection {
  indeclinable = "indeclinable ",
  diptote = "diptote ",
  triptote = "triptote ",
}

export const createFlashcardStatement = ({
  dictionaryEntryId,
  direction,
  flashcardData,
}: {
  dictionaryEntryId: string;
  direction: "forward" | "reverse";
  flashcardData?: z.infer<typeof DictionarySchema>["flashcard"];
}) => {
  const emptyCard = createEmptyCard(new Date());

  const dueMs = flashcardData?.due_timestamp
    ? flashcardData.due_timestamp * 1000
    : new Date(emptyCard.due).getTime();
  const lastReviewMs = flashcardData?.last_review_timestamp
    ? flashcardData.last_review_timestamp * 1000
    : null;

  return {
    sql: `INSERT INTO flashcards (
      id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days,
      lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state, direction, is_hidden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dictionary_entry_id, direction) DO UPDATE SET
      difficulty = excluded.difficulty,
      due = excluded.due,
      due_timestamp_ms = excluded.due_timestamp_ms,
      elapsed_days = excluded.elapsed_days,
      lapses = excluded.lapses,
      last_review = excluded.last_review,
      last_review_timestamp_ms = excluded.last_review_timestamp_ms,
      reps = excluded.reps,
      scheduled_days = excluded.scheduled_days,
      stability = excluded.stability,
      state = excluded.state`,
    args: [
      nanoid(),
      dictionaryEntryId,
      flashcardData?.difficulty ?? emptyCard.difficulty,
      flashcardData?.due ?? emptyCard.due.toISOString(),
      dueMs,
      flashcardData?.elapsed_days ?? emptyCard.elapsed_days,
      flashcardData?.lapses ?? emptyCard.lapses,
      flashcardData?.last_review ?? null,
      lastReviewMs,
      flashcardData?.reps ?? emptyCard.reps,
      flashcardData?.scheduled_days ?? emptyCard.scheduled_days,
      flashcardData?.stability ?? emptyCard.stability,
      flashcardData?.state ?? emptyCard.state,
      direction,
      0,
    ],
  };
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 2, // 2 MB in bytes
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/json") {
      cb(new Error("Invalid file type"));

      return;
    }

    cb(null, true);
  },
}).single("dictionary");

const uploadWithErrorHandling = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload(req, res, (err) => {
    if (err instanceof Error) {
      if (err.message.includes("Invalid file type")) {
        return res.status(400).json({ message: err.message });
      }

      return res.status(500).json({ message: err.message });
    }

    return next();
  });
};

export const dictionaryRouter: Router = express.Router();

dictionaryRouter.post(
  "/dictionary/import",
  auth,
  uploadWithErrorHandling,
  async (req, res) => {
    const fileData = req.file?.buffer.toString("utf-8");

    if (!fileData) {
      return res.status(200).end();
    }

    let dictionary;

    try {
      dictionary = JSON.parse(fileData);
    } catch (error) {
      return res.status(400).json({
        message: "Invalid JSON format.",
        code: ImportErrorCode.INVALID_JSON,
      });
    }

    const validationResult = WordsSchema.safeParse(dictionary);

    if (!validationResult.success) {
      console.error(
        "Error importing dictionary",
        JSON.stringify(validationResult.error.errors, null, 2),
      );

      return res.status(400).json({
        error: validationResult.error,
        code: ImportErrorCode.VALIDATION_ERROR,
      } as ImportResponseError);
    }

    const validatedDictionary = validationResult.data;

    // Add timestamps to any record that doesn't have it.
    const preProcessedDictionary = validatedDictionary.map(addTimestamps);

    // The user's index has the same id as their user id
    const userIndexId = req.user.id;
    const index = meilisearchClient.index(userIndexId);

    try {
      // Adds or replaces documents
      const { taskUid: addTaskUid } = await index.addDocuments(
        preProcessedDictionary,
      );

      const addDocumentsTask = await meilisearchClient.waitForTask(addTaskUid);

      if (addDocumentsTask.error) {
        const error = addDocumentsTask.error;

        throw new MeilisearchError({
          message: error.message,
          code: error.code,
          type: error.type,
        });
      }

      try {
        const userDbClient = await getUserDbClient(req.user.id);

        if (userDbClient) {
          const now = new Date();

          const BATCH_SIZE = 100;

          for (const batch of batchIterator(
            preProcessedDictionary,
            BATCH_SIZE,
          )) {
            const statements = [];

            for (const word of batch) {
              const createdAtTimestampMs = word.created_at_timestamp
                ? word.created_at_timestamp * 1000
                : now.getTime();
              const updatedAtTimestampMs = word.updated_at_timestamp
                ? word.updated_at_timestamp * 1000
                : now.getTime();

              statements.push({
                sql: `INSERT INTO dictionary_entries (
                  id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
                  created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  word = excluded.word,
                  translation = excluded.translation,
                  definition = excluded.definition,
                  type = excluded.type,
                  root = excluded.root,
                  tags = excluded.tags,
                  antonyms = excluded.antonyms,
                  examples = excluded.examples,
                  morphology = excluded.morphology,
                  updated_at = excluded.updated_at,
                  updated_at_timestamp_ms = excluded.updated_at_timestamp_ms`,
                args: [
                  word.id,
                  word.word,
                  word.translation,
                  word.definition ?? null,
                  word.type ?? null,
                  word.root ? JSON.stringify(word.root) : null,
                  word.tags ? JSON.stringify(word.tags) : null,
                  word.antonyms ? JSON.stringify(word.antonyms) : null,
                  word.examples ? JSON.stringify(word.examples) : null,
                  word.morphology ? JSON.stringify(word.morphology) : null,
                  word.created_at,
                  createdAtTimestampMs,
                  word.updated_at,
                  updatedAtTimestampMs,
                ],
              });

              statements.push(
                createFlashcardStatement({
                  dictionaryEntryId: word.id,
                  direction: "forward",
                  flashcardData: word.flashcard,
                }),
              );

              statements.push(
                createFlashcardStatement({
                  dictionaryEntryId: word.id,
                  direction: "reverse",
                  flashcardData: word.flashcard_reverse,
                }),
              );
            }

            await userDbClient.batch(statements);
          }

          console.log(
            `Successfully imported ${preProcessedDictionary.length} entries to user DB`,
          );
        }
      } catch (err) {
        console.error("Failed to write dictionary import to user DB", err);
      }
    } catch (error) {
      console.error(error);
      if (error instanceof MeilisearchError) {
        return res.status(500).json({ code: error.code, type: error.type });
      } else {
        return res.status(500).json({ code: ErrorCode.UNKNOWN_ERROR });
      }
    }

    return res.status(200).end();
  },
);

dictionaryRouter.post("/dictionary/export", auth, async (req, res) => {
  const userIndexId = req.user.id;
  const index = meilisearchClient.index(userIndexId);

  const shouldExportWithFlashcards = req.body?.includeFlashcards ?? false;

  const fieldsToExport = JSON_SCHEMA_FIELDS.filter((field) =>
    !shouldExportWithFlashcards
      ? field !== "flashcard" &&
        field !== "flashcard_reverse" &&
        // When flashcards are included in an export, that implies the file is a backup.
        // So we only want to include timestamps in backups, not shared dictionaries.
        field !== "created_at" &&
        field !== "created_at_timestamp" &&
        field !== "updated_at" &&
        field !== "updated_at_timestamp"
      : true,
  );

  const limit = 1000;
  const allDocuments = [];

  let offset = 0;

  try {
    let hasMoreDocuments = true;

    do {
      const { results, total } = await index.getDocuments({
        offset,
        limit,
        fields: fieldsToExport,
      });

      if (results.length > 0 && results.length <= total) {
        allDocuments.push(...results);

        offset += limit;
      } else {
        hasMoreDocuments = false; // No more documents to fetch
      }
    } while (hasMoreDocuments);

    // Set headers for downloading the file
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=data.json");

    return res.status(200).json(allDocuments);
  } catch (error) {
    console.error("Error exporting dictionary:", error);

    return res.status(500).json({ error: "Error exporting dictionary" });
  }
});

dictionaryRouter.delete("/dictionary", auth, async (req, res) => {
  const userIndexId = req.user.id;
  const index = meilisearchClient.index(userIndexId);

  const { taskUid: deleteTaskUid } = await index.deleteAllDocuments();

  const deleteTask = await meilisearchClient.waitForTask(deleteTaskUid);

  if (deleteTask.error) {
    const error = deleteTask.error;

    return res.status(500).json({ code: error.code, type: error.type });
  }

  try {
    const userDbClient = await getUserDbClient(req.user.id);

    if (userDbClient) {
      // Will cascade delete all associated flashcards
      await userDbClient.execute("DELETE FROM dictionary_entries");

      console.log("Successfully deleted all entries from user DB");
    }
  } catch (err) {
    console.error("Failed to delete all entries from user DB", err);
  }

  return res.status(200).end();
});

export const trpcDictionaryRouter = router({
  find: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(DictionarySchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const userIndex = meilisearchClient.index(user.id);

      const word = (await userIndex.getDocument(input.id)) as z.infer<
        typeof DictionarySchema
      >;

      return word;
    }),
  deleteWord: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const userIndex = meilisearchClient.index(user.id);

      try {
        const { taskUid } = await userIndex.deleteDocument(input.id);

        const { status, error } = await userIndex.waitForTask(taskUid);

        if (status === "failed" && error) {
          const { message, code, type } = error;

          throw new MeilisearchError({
            message,
            code,
            type,
          });
        }

        try {
          const userDbClient = await getUserDbClient(user.id);

          if (userDbClient) {
            await userDbClient.execute({
              sql: "DELETE FROM dictionary_entries WHERE id = ?",
              args: [input.id],
            });

            ctx.logger.info(
              {
                userId: user.id,
                category: "database",
                event: "dictionary.deleteWord.dual_write.success",
              },
              "Successfully deleted dictionary entry from user DB",
            );
          }
        } catch (err) {
          ctx.logger.error(
            {
              err,
              userId: user.id,
              category: "database",
              event: "dictionary.deleteWord.dual_write.error",
            },
            "Failed to delete dictionary entry from user DB",
          );
        }

        // TODO: add better return type
        return true;
      } catch (err) {
        if (err instanceof MeilisearchError) {
          console.error(err.code, err.type, err.message);
        } else if (err instanceof Error) {
          console.error(err.message);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "unexpected_error",
        });
      }
    }),
  editWord: protectedProcedure
    .input(DictionarySchema.deepPartial())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const userIndex = meilisearchClient.index(user.id);

      const now = new Date();
      const updatedAt = now.toISOString();
      const updatedAtTimestamp = Math.floor(now.getTime() / 1000);

      ctx.logger.debug(input, "Updating dictionary entry...");

      try {
        const { taskUid } = await userIndex.updateDocuments([
          {
            ...input,
            updated_at: updatedAt,
            updated_at_timestamp: updatedAtTimestamp,
          },
        ]);

        const { status, error } = await userIndex.waitForTask(taskUid);

        if (status === "failed" && error) {
          const { message, code, type } = error;

          throw new MeilisearchError({
            message,
            code,
            type,
          });
        }

        try {
          const userDbClient = await getUserDbClient(user.id);

          if (userDbClient && input.id) {
            const updatedAtTimestampMs = now.getTime();
            const updates: string[] = [];
            const args: (string | number | null)[] = [];

            if (input.word !== undefined) {
              updates.push("word = ?");
              args.push(input.word);
            }
            if (input.translation !== undefined) {
              updates.push("translation = ?");
              args.push(input.translation);
            }
            if (input.definition !== undefined) {
              updates.push("definition = ?");
              args.push(input.definition ?? null);
            }
            if (input.type !== undefined) {
              updates.push("type = ?");
              args.push(input.type ?? null);
            }
            if (input.root !== undefined) {
              updates.push("root = ?");
              args.push(input.root ? JSON.stringify(input.root) : null);
            }
            if (input.tags !== undefined) {
              updates.push("tags = ?");
              args.push(input.tags ? JSON.stringify(input.tags) : null);
            }
            if (input.antonyms !== undefined) {
              updates.push("antonyms = ?");
              args.push(input.antonyms ? JSON.stringify(input.antonyms) : null);
            }
            if (input.examples !== undefined) {
              updates.push("examples = ?");
              args.push(input.examples ? JSON.stringify(input.examples) : null);
            }
            if (input.morphology !== undefined) {
              updates.push("morphology = ?");
              args.push(
                input.morphology ? JSON.stringify(input.morphology) : null,
              );
            }

            if (updates.length > 0) {
              updates.push("updated_at = ?", "updated_at_timestamp_ms = ?");
              args.push(updatedAt, updatedAtTimestampMs);
              args.push(input.id);

              await userDbClient.execute({
                sql: `UPDATE dictionary_entries SET ${updates.join(
                  ", ",
                )} WHERE id = ?`,
                args,
              });

              ctx.logger.info(
                {
                  userId: user.id,
                  category: "database",
                  event: "dictionary.editWord.dual_write.success",
                },
                "Successfully updated dictionary entry in user DB",
              );
            }
          }
        } catch (err) {
          ctx.logger.error(
            {
              err,
              userId: user.id,
              category: "database",
              event: "dictionary.editWord.dual_write.error",
            },
            "Failed to update dictionary entry in user DB",
          );
        }

        // TODO: add better return type
        return true;
      } catch (err) {
        if (err instanceof MeilisearchError) {
          console.error(err.code, err.type, err.message);
        } else if (err instanceof Error) {
          console.error(err.message);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "unexpected_error",
        });
      }
    }),
  addWord: protectedProcedure
    .input(DictionarySchema.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const userIndex = meilisearchClient.index(user.id);

      const now = new Date();
      const createdAt = now.toISOString();
      const createdAtTimestamp = Math.floor(now.getTime() / 1000);
      const id = nanoid();

      try {
        const { taskUid } = await userIndex.addDocuments([
          {
            ...input,
            id,
            created_at: createdAt,
            created_at_timestamp: createdAtTimestamp,
            updated_at: createdAt,
            updated_at_timestamp: createdAtTimestamp,
          },
        ]);

        const { status, error } = await userIndex.waitForTask(taskUid);

        if (status === "failed" && error) {
          const { message, code, type } = error;

          throw new MeilisearchError({
            message,
            code,
            type,
          });
        }

        try {
          const userDbClient = await getUserDbClient(user.id);

          if (userDbClient) {
            const createdAtTimestampMs = now.getTime();

            await userDbClient.execute({
              sql: `INSERT INTO dictionary_entries (
                id, word, translation, definition, type, root, tags, antonyms, examples, morphology,
                created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                id,
                input.word,
                input.translation,
                input.definition ?? null,
                input.type ?? null,
                input.root ? JSON.stringify(input.root) : null,
                input.tags ? JSON.stringify(input.tags) : null,
                input.antonyms ? JSON.stringify(input.antonyms) : null,
                input.examples ? JSON.stringify(input.examples) : null,
                input.morphology ? JSON.stringify(input.morphology) : null,
                createdAt,
                createdAtTimestampMs,
                createdAt,
                createdAtTimestampMs,
              ],
            });

            const emptyCard = createEmptyCard(now);
            const dueDate = new Date(emptyCard.due);
            const dueTimestampMs = dueDate.getTime();

            await userDbClient.batch([
              {
                sql: `INSERT INTO flashcards (
                  id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days,
                  lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state, direction, is_hidden
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  nanoid(),
                  id,
                  emptyCard.difficulty,
                  emptyCard.due.toISOString(),
                  dueTimestampMs,
                  emptyCard.elapsed_days,
                  emptyCard.lapses,
                  emptyCard.last_review?.toISOString() ?? null,
                  emptyCard.last_review?.getTime() ?? null,
                  emptyCard.reps,
                  emptyCard.scheduled_days,
                  emptyCard.stability,
                  emptyCard.state,
                  "forward",
                  0,
                ],
              },
              {
                sql: `INSERT INTO flashcards (
                  id, dictionary_entry_id, difficulty, due, due_timestamp_ms, elapsed_days,
                  lapses, last_review, last_review_timestamp_ms, reps, scheduled_days, stability, state, direction, is_hidden
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  nanoid(),
                  id,
                  emptyCard.difficulty,
                  emptyCard.due.toISOString(),
                  dueTimestampMs,
                  emptyCard.elapsed_days,
                  emptyCard.lapses,
                  emptyCard.last_review?.toISOString() ?? null,
                  emptyCard.last_review?.getTime() ?? null,
                  emptyCard.reps,
                  emptyCard.scheduled_days,
                  emptyCard.stability,
                  emptyCard.state,
                  "reverse",
                  0,
                ],
              },
            ]);

            ctx.logger.info(
              {
                userId: user.id,
                category: "database",
                event: "dictionary.addWord.dual_write.success",
              },
              "Successfully wrote dictionary entry to user DB",
            );
          }
        } catch (err) {
          ctx.logger.error(
            {
              err,
              userId: user.id,
              category: "database",
              event: "dictionary.addWord.dual_write.error",
            },
            "Failed to write dictionary entry to user DB",
          );
        }

        // TODO: add better return type
        return true;
      } catch (err) {
        if (err instanceof MeilisearchError) {
          console.error(err.code, err.type, err.message);
        } else if (err instanceof Error) {
          console.error(err.message);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "unexpected_error",
        });
      }
    }),
});

const addTimestamps = (word: z.infer<typeof DictionarySchema>) => {
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000); // seconds
  const isoString = now.toISOString();

  if (!word.created_at_timestamp || !word.created_at) {
    word.created_at = now.toISOString();
    word.created_at_timestamp = Math.floor(now.getTime() / 1000);
  }

  if (!word.updated_at_timestamp || !word.updated_at) {
    word.updated_at = now.toISOString();
    word.updated_at_timestamp = Math.floor(now.getTime() / 1000);
  }

  return {
    ...word,
    created_at: word.created_at ?? isoString,
    created_at_timestamp: word.created_at_timestamp ?? timestamp,
    updated_at: word.updated_at ?? isoString,
    updated_at_timestamp: word.updated_at_timestamp ?? timestamp,
  };
};
