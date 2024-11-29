import { MeiliSearch } from "meilisearch";

export const meilisearchClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_API_KEY!,
});

//  TODO: Create single source of truth between this and script in the root

const MAX_TOTAL_HITS = 2000;

/**
 * Creates a new index for a user and configures it
 * with the necessary universal settings.
 *
 * @param userId The user's id.
 */
export const createUserIndex = async (userId: string) => {
  const { taskUid: createTaskUid } =
    await meilisearchClient.createIndex(userId);

  await meilisearchClient.waitForTask(createTaskUid);

  const userIndex = meilisearchClient.index(userId);

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

  await meilisearchClient.waitForTask(updateTaskUid);
};
