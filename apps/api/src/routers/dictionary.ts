import express, {
  type Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Ajv, { type ErrorObject } from "ajv";
import multer from "multer";

import schema from "../schema.json";
import { meilisearchClient } from "../meilisearch";
import { auth } from "../middleware";

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
    const ajv = new Ajv();
    const fileData = req.file?.buffer.toString("utf-8");

    if (!fileData) {
      return res.status(200).end();
    }

    const dictionary = JSON.parse(fileData) as Record<string, any>[];

    const validate = ajv.compile(schema);
    const isValid = validate(dictionary);

    if (!isValid) {
      // TODO: Translate error messages
      const parsedErrors = parseAjvErrors(validate.errors!);

      return res.status(400).send(parsedErrors);
    }

    // The flow for importing the dictionary is:
    // 1. Create a temp index
    // 2. Add documents to the temp index
    // 3. Swap indexes
    // 4. Delete the temp index

    // The user's index has the same id as their user id
    const userIndexId = req.user.id;
    const tempIndexId = `${userIndexId}_temp`;

    const createTempIndexTask =
      await meilisearchClient.createIndex(tempIndexId);
    await meilisearchClient.waitForTask(createTempIndexTask.taskUid);

    const tempIndex = meilisearchClient.index(tempIndexId);

    const addDocumentsTask = await tempIndex.addDocuments(dictionary);
    await meilisearchClient.waitForTask(addDocumentsTask.taskUid);

    const swapIndexesTask = await meilisearchClient.swapIndexes([
      { indexes: [userIndexId, tempIndexId] },
    ]);
    await meilisearchClient.waitForTask(swapIndexesTask.taskUid);

    const deleteTempIndexTask =
      await meilisearchClient.deleteIndex(tempIndexId);
    await meilisearchClient.waitForTask(deleteTempIndexTask.taskUid);

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

const parseAjvErrors = (errors: ErrorObject[]): string[] => {
  const errorMessages: string[] = [];

  if (errors && errors.length > 0) {
    errors.forEach((error) => {
      const instancePath = error.instancePath.replace(
        /^\/(\d+)/,
        (_, index) => `Index ${index} `,
      );
      const keyword = error.keyword;
      const params = error.params;

      let message = error.message ?? "";

      switch (keyword) {
        case "type":
          message = `${instancePath} must be ${params.type}`;
          break;
        case "required":
          message = `${instancePath}${params.missingProperty} is required`;
          break;
        default:
          break;
      }

      errorMessages.push(message);
    });
  }

  return errorMessages;
};
