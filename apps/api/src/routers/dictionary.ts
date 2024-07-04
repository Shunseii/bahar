import express, {
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Ajv from "ajv";
import multer from "multer";

import schema from "../schema.json";
import { meilisearchClient } from "../clients/meilisearch";
import { auth } from "../middleware";
import { ErrorCode, MeilisearchError } from "../error";

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

  const documents = await index.getDocuments();
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
