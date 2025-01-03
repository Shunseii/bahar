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
} from "../error";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DictionarySchema } from "../schemas/dictionary.schema";
import { WordsSchema } from "../schemas/words.schema";

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

      ctx.logger.info(input, "Updating dictionary entry...");

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

      try {
        const { taskUid } = await userIndex.addDocuments([
          {
            ...input,
            id: nanoid(),
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
