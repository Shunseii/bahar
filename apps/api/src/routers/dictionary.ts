import express, {
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Ajv from "ajv";
import multer from "multer";

import schema from "../schema.json";
import { meilisearchClient } from "../meilisearch";
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
    const tempIndexId = `${userIndexId}_temp`;

    // TODO: Check if the temporary index already exists before creating it
    // If it does, either delete it or empty it

    // 1. Create a temp index
    {
      const { taskUid: createTaskUid } =
        await meilisearchClient.createIndex(tempIndexId);

      const createTempIndexTask =
        await meilisearchClient.waitForTask(createTaskUid);

      if (createTempIndexTask.error) {
        const error = createTempIndexTask.error;

        console.error(error);

        return res.status(500).json({ code: error.code, type: error.type });
      }
    }

    const tempIndex = meilisearchClient.index(tempIndexId);

    // 2. Add documents to the temp index
    try {
      const { taskUid: addTaskUid } = await tempIndex.addDocuments(dictionary);

      const addDocumentsTask = await meilisearchClient.waitForTask(addTaskUid);

      if (addDocumentsTask.error) {
        const error = addDocumentsTask.error;

        throw new MeilisearchError({
          message: error.message,
          code: error.code,
          type: error.type,
        });
      }

      // 3. Swap indexes
      const { taskUid: swapTaskUid } = await meilisearchClient.swapIndexes([
        { indexes: [userIndexId, tempIndexId] },
      ]);

      const swapIndexesTask = await meilisearchClient.waitForTask(swapTaskUid);

      if (swapIndexesTask.error) {
        const error = swapIndexesTask.error;

        throw new MeilisearchError({
          message: error.message,
          code: error.code,
          type: error.type,
        });
      }
    } catch (error) {
      console.error(error);

      // Rollback the temporary index
      const deleteTempIndexTask =
        await meilisearchClient.deleteIndex(tempIndexId);

      await meilisearchClient.waitForTask(deleteTempIndexTask.taskUid);

      if (error instanceof MeilisearchError) {
        return res.status(500).json({ code: error.code, type: error.type });
      } else {
        return res.status(500).json({ code: ErrorCode.UNKNOWN_ERROR });
      }
    }

    // 4. Delete the temp index
    {
      const { taskUid: deleteTaskUid } =
        await meilisearchClient.deleteIndex(tempIndexId);

      const deleteTempIndexTask =
        await meilisearchClient.waitForTask(deleteTaskUid);

      if (deleteTempIndexTask.error) {
        const error = deleteTempIndexTask.error;

        return res.status(500).json({ code: error.code, type: error.type });
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
