import express, {
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { nanoid } from "nanoid";
import Ajv from "ajv";
import { router, protectedProcedure } from "../trpc";
import addFormats from "ajv-formats";
import multer from "multer";

import schema from "../schema.json";
import { meilisearchClient } from "../clients/meilisearch";
import { auth } from "../middleware";
import { ErrorCode, MeilisearchError } from "../error";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// TODO: use shared schema between client and server

export enum Inflection {
  indeclinable = 1,
  diptote = 2,
  triptote = 3,
}

export const DictionarySchema = z.object({
  word: z.string().min(1),
  translation: z.string().min(1),
  definition: z.string().optional(),
  root: z.string().optional(),
  examples: z
    .array(
      z.object({
        sentence: z.string(),
        context: z.string().optional(),
        translation: z.string().optional(),
      }),
    )
    .optional(),
  type: z.enum(["ism", "fi'l", "harf"]).optional(),
  morphology: z
    .object({
      ism: z
        .object({
          singular: z.string().optional(),
          dual: z.string().optional(),
          plurals: z
            .array(
              z.object({ word: z.string(), details: z.string().optional() }),
            )
            .optional(),
          gender: z.enum(["masculine", "feminine"]).optional(),
          inflection: z.nativeEnum(Inflection).optional(),
        })
        .optional(),
      verb: z
        .object({
          huroof: z
            .array(
              z.object({
                harf: z.string(),
                meaning: z.string().optional(),
              }),
            )
            .optional(),
          past_tense: z.string().optional(),
          present_tense: z.string().optional(),
          active_participle: z.string().optional(),
          passive_participle: z.string().optional(),
          imperative: z.string().optional(),
          masadir: z
            .array(
              z.object({
                word: z.string(),
                details: z.string().optional(),
              }),
            )
            .optional(),
          form: z.string().optional(),
          form_arabic: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

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
    const ajv = new Ajv({ allErrors: false });
    addFormats(ajv, ["date-time"]);

    const fileData = req.file?.buffer.toString("utf-8");

    if (!fileData) {
      return res.status(200).end();
    }

    const dictionary = JSON.parse(fileData) as Record<string, any>[];

    const validate = ajv.compile(schema);
    const isValid = validate(dictionary);

    if (!isValid) {
      return res.status(400).send(validate.errors);
    }

    // The user's index has the same id as their user id
    const userIndexId = req.user.id;
    const index = meilisearchClient.index(userIndexId);

    try {
      // Adds or replaces documents
      const { taskUid: addTaskUid } = await index.addDocuments(dictionary);

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

  const documents = await index.getDocuments({ limit: 1000 });
  const dictionary = documents.results;

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=data.json");

  return res.status(200).json(dictionary);
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
  add: protectedProcedure
    .input(DictionarySchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const userIndex = meilisearchClient.index(user.id);

      try {
        const { taskUid } = await userIndex.addDocuments([
          { ...input, id: nanoid() },
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
