import { db } from "../src/db";
import { users } from "../src/db/schema/auth";
import { databases } from "../src/db/schema/databases";
import { eq } from "drizzle-orm";
import { logger } from "../src/utils/logger";
import { createUserDbClient } from "../src/utils/migration-utils";
import { meilisearchClient } from "../src/clients/meilisearch";
import { DictionarySchema } from "../src/schemas/dictionary.schema";
import { z } from "zod";
import { createFlashcardStatement } from "../src/routers/dictionary";
import { InStatement } from "@libsql/client";

const BATCH_SIZE = 500;

const migrateMeilisearchToUserDb = async () => {
  logger.info(
    "Starting Meilisearch to user database migration for dictionary entries...",
  );

  try {
    const usersWithDb = await db
      .select()
      .from(users)
      .innerJoin(databases, eq(users.id, databases.user_id));

    logger.info(`Found ${usersWithDb.length} users with databases.`);

    let successCount = 0;
    let errorCount = 0;
    let totalWordsProcessed = 0;
    let totalWordsSkipped = 0;
    let totalWordsMigrated = 0;

    for (const { users: user, databases: userDb } of usersWithDb) {
      logger.info(
        { email: user.email, user_id: user.id },
        `Processing user...`,
      );

      try {
        const { client: userDbClient } = await createUserDbClient(
          userDb.hostname,
          userDb.access_token,
          userDb.db_name,
          userDb.db_id,
        );

        const userIndex = meilisearchClient.index(user.id);

        let userWordsSkipped = 0;
        let userWordsMigrated = 0;
        let offset = 0;

        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const result = await userIndex.getDocuments<
              z.infer<typeof DictionarySchema>
            >({
              offset,
              limit: BATCH_SIZE,
            });

            if (result.results.length === 0) {
              break;
            }

            logger.info(
              {
                email: user.email,
                user_id: user.id,
                batchSize: result.results.length,
                offset,
              },
              `Fetched ${result.results.length} words from Meilisearch`,
            );

            const statements: InStatement[] = [];

            for (const word of result.results) {
              const existingWord = await userDbClient.execute({
                sql: "SELECT id FROM dictionary_entries WHERE id = ?",
                args: [word.id],
              });

              if (existingWord.rows.length > 0) {
                userWordsSkipped++;
                continue;
              }

              const createdAtMs = word.created_at_timestamp
                ? word.created_at_timestamp * 1000
                : Date.now();
              const updatedAtMs = word.updated_at_timestamp
                ? word.updated_at_timestamp * 1000
                : Date.now();

              statements.push({
                sql: `INSERT INTO dictionary_entries (
                  id, word, translation, type, definition, root, tags, antonyms,
                  examples, morphology, created_at, created_at_timestamp_ms, updated_at, updated_at_timestamp_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  word = excluded.word,
                  translation = excluded.translation,
                  type = excluded.type,
                  definition = excluded.definition,
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
                  word.type ?? null,
                  word.definition ?? null,
                  word.root ? JSON.stringify(word.root) : null,
                  word.tags ? JSON.stringify(word.tags) : null,
                  word.antonyms ? JSON.stringify(word.antonyms) : null,
                  word.examples ? JSON.stringify(word.examples) : null,
                  word.morphology ? JSON.stringify(word.morphology) : null,
                  word.created_at ?? new Date(createdAtMs).toISOString(),
                  createdAtMs,
                  word.updated_at ?? new Date(updatedAtMs).toISOString(),
                  updatedAtMs,
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

              userWordsMigrated++;
            }

            if (statements.length > 0) {
              await userDbClient.batch(statements);
              logger.info(
                {
                  email: user.email,
                  user_id: user.id,
                  statementCount: statements.length,
                },
                `Wrote batch to Turso`,
              );
            }

            offset += BATCH_SIZE;

            if (result.results.length < BATCH_SIZE) {
              break;
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (
            errorMessage.includes("index_not_found") ||
            errorMessage.includes("Index") ||
            errorMessage.includes("not found")
          ) {
            logger.info(
              { email: user.email, user_id: user.id },
              "No Meilisearch index found for user, skipping",
            );
            continue;
          }
          throw err;
        }

        logger.info(
          {
            email: user.email,
            user_id: user.id,
            migratedCount: userWordsMigrated,
            skippedCount: userWordsSkipped,
          },
          `Migrated ${userWordsMigrated} words, skipped ${userWordsSkipped} words`,
        );

        totalWordsProcessed += userWordsMigrated + userWordsSkipped;
        totalWordsSkipped += userWordsSkipped;
        totalWordsMigrated += userWordsMigrated;
        successCount++;
      } catch (err) {
        errorCount++;
        logger.error(
          {
            err,
            email: user.email,
            user_id: user.id,
          },
          `Failed to migrate Meilisearch data for user. Skipping.`,
        );
      }
    }

    logger.info(
      {
        totalUsers: usersWithDb.length,
        successCount,
        errorCount,
        totalWordsProcessed,
        totalWordsMigrated,
        totalWordsSkipped,
      },
      "Migration completed!",
    );
  } catch (error) {
    logger.error(error, "Migration failed");
    process.exit(1);
  }
};

(async () => {
  try {
    await migrateMeilisearchToUserDb();
    logger.info("Migration script finished successfully");
  } catch (error) {
    console.error("Error migrating Meilisearch data:", error);
    process.exit(1);
  }
})();
