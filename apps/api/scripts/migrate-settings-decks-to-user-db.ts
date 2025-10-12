import { db } from "../src/db";
import { users } from "../src/db/schema/auth";
import { databases } from "../src/db/schema/databases";
import { settings } from "../src/db/schema/settings";
import { decks } from "../src/db/schema/decks";
import { eq } from "drizzle-orm";
import { logger } from "../src/utils/logger";
import { createClient } from "@libsql/client";
import { tursoPlatformClient } from "../src/clients/turso";

/**
 * Refreshes an expired access token for a user database
 */
const refreshAccessToken = async (
  dbName: string,
  dbId: string,
): Promise<string> => {
  logger.info({ dbName, dbId }, "Access token expired, creating new token...");

  const newToken = await tursoPlatformClient.databases.createToken(dbName, {
    authorization: "full-access",
    expiration: "2w",
  });

  // Update the token in the databases table
  await db
    .update(databases)
    .set({ access_token: newToken.jwt })
    .where(eq(databases.db_id, dbId));

  logger.info({ dbName, dbId }, "Created and saved new access token");

  return newToken.jwt;
};

/**
 * Creates a database client, refreshing the token if it's expired
 */
const createUserDbClient = async (
  hostname: string,
  accessToken: string,
  dbName: string,
  dbId: string,
) => {
  const client = createClient({
    url: `libsql://${hostname}`,
    authToken: accessToken,
  });

  // Test the connection
  try {
    await client.execute("SELECT 1");
    return { client, token: accessToken };
  } catch (err) {
    // Check if it's an auth error
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("status 401")) {
      logger.info(
        { dbName, dbId },
        "Token appears to be expired, refreshing...",
      );
      const newToken = await refreshAccessToken(dbName, dbId);
      const newClient = createClient({
        url: `libsql://${hostname}`,
        authToken: newToken,
      });
      return { client: newClient, token: newToken };
    }
    // If it's not an auth error, rethrow
    throw err;
  }
};

/**
 * Script that migrates settings and decks data from the global database
 * to each user's individual database.
 *
 * This script is idempotent - it can be run multiple times safely.
 * It will skip records that already exist in the user database.
 */
const migrateSettingsAndDecksToUserDb = async () => {
  logger.info("Starting settings and decks migration to user databases...");

  try {
    // Get all users who have a user database
    const usersWithDb = await db
      .select()
      .from(users)
      .innerJoin(databases, eq(users.id, databases.user_id));

    logger.info(`Found ${usersWithDb.length} users with databases.`);

    let successCount = 0;
    let errorCount = 0;

    for (const { users: user, databases: userDb } of usersWithDb) {
      logger.info(
        { email: user.email, user_id: user.id },
        `Processing user...`,
      );

      try {
        // Connect to user's database (with automatic token refresh if needed)
        const { client: userDbClient } = await createUserDbClient(
          userDb.hostname,
          userDb.access_token,
          userDb.db_name,
          userDb.db_id,
        );

        // Migrate settings
        const globalSettings = await db
          .select()
          .from(settings)
          .where(eq(settings.user_id, user.id))
          .limit(1);

        if (globalSettings.length > 0) {
          const setting = globalSettings[0];

          // Check if settings already exist in user DB
          const existingSettings = await userDbClient.execute(
            "SELECT id FROM settings LIMIT 1",
          );

          if (existingSettings.rows.length === 0) {
            // Insert settings into user DB (without user_id since it's not needed in user-specific DB)
            await userDbClient.execute({
              sql: `INSERT INTO settings (id, show_reverse_flashcards, show_antonyms_in_flashcard)
                    VALUES (?, ?, ?)`,
              args: [
                setting.id,
                setting.show_reverse_flashcards ? 1 : 0,
                setting.show_antonyms_in_flashcard,
              ],
            });

            logger.info(
              { email: user.email, user_id: user.id },
              "Migrated settings to user DB",
            );
          } else {
            logger.info(
              { email: user.email, user_id: user.id },
              "Settings already exist in user DB, skipping",
            );
          }
        } else {
          logger.info(
            { email: user.email, user_id: user.id },
            "No settings found in global DB",
          );
        }

        // Migrate decks
        const globalDecks = await db
          .select()
          .from(decks)
          .where(eq(decks.user_id, user.id));

        logger.info(
          {
            email: user.email,
            user_id: user.id,
            deckCount: globalDecks.length,
          },
          `Found ${globalDecks.length} decks in global DB`,
        );

        let migratedDeckCount = 0;
        let skippedDeckCount = 0;

        for (const deck of globalDecks) {
          // Check if deck already exists in user DB
          const existingDeck = await userDbClient.execute({
            sql: "SELECT id FROM decks WHERE id = ?",
            args: [deck.id],
          });

          if (existingDeck.rows.length === 0) {
            // Insert deck into user DB (without user_id)
            await userDbClient.execute({
              sql: "INSERT INTO decks (id, name, filters) VALUES (?, ?, ?)",
              args: [deck.id, deck.name, JSON.stringify(deck.filters)],
            });

            migratedDeckCount++;
          } else {
            skippedDeckCount++;
          }
        }

        logger.info(
          {
            email: user.email,
            user_id: user.id,
            migratedDeckCount,
            skippedDeckCount,
          },
          `Migrated ${migratedDeckCount} decks, skipped ${skippedDeckCount} decks`,
        );

        successCount++;
      } catch (err) {
        errorCount++;
        logger.error(
          {
            err,
            email: user.email,
            user_id: user.id,
          },
          `Failed to migrate data for user. Skipping.`,
        );
      }
    }

    logger.info(
      {
        totalUsers: usersWithDb.length,
        successCount,
        errorCount,
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
    await migrateSettingsAndDecksToUserDb();
    logger.info("Migration script finished successfully");
  } catch (error) {
    console.error("Error migrating settings and decks:", error);
    process.exit(1);
  }
})();
