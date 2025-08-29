import { MeiliSearch } from "meilisearch";
import { config } from "../config";
import { LogCategory, logger } from "../logger";

export const meilisearchClient = new MeiliSearch({
  host: config.MEILISEARCH_HOST!,
  apiKey: config.MEILISEARCH_API_KEY!,
});

//  TODO: Create single source of truth between this and script in the root
//  Not high priority since I will be removing meilisearch

const MAX_TOTAL_HITS = 2000;

/**
 * Creates a new index for a user and configures it
 * with the necessary universal settings.
 *
 * @param indexName The name of the index to create.
 */
export const createUserIndex = async (indexName: string) => {
  const { taskUid: createTaskUid } =
    await meilisearchClient.createIndex(indexName);

  await meilisearchClient.waitForTask(createTaskUid);

  const userIndex = meilisearchClient.index(indexName);

  logger.info(
    { indexName, category: LogCategory.DATABASE, event: "index_created.start" },
    "Creating user index...",
  );

  const { taskUid: updateTaskUid } = await userIndex.updateSettings({
    sortableAttributes: [
      "flashcard.due_timestamp",
      "flashcard_reverse.due_timestamp",
    ],
    filterableAttributes: [
      "flashcard.due_timestamp",
      "flashcard_reverse.due_timestamp",
      "tags",
      "type",
    ],
    pagination: {
      maxTotalHits: MAX_TOTAL_HITS,
    },
  });

  const task = await meilisearchClient.waitForTask(updateTaskUid);

  logger.info(
    {
      task,
      indexName,
      category: LogCategory.DATABASE,
      event: "index_created.end",
    },
    "Created user index.",
  );
};
