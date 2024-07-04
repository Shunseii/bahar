import { MeiliSearch } from "meilisearch";

export const meilisearchClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_API_KEY!,
});

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
    filterableAttributes: ["flashcard.due_timestamp"],
  });

  await meilisearchClient.waitForTask(updateTaskUid);
};
