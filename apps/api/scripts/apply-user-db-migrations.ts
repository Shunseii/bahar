import { eq } from "drizzle-orm";
import {
  applyAllNewMigrations,
  tursoPlatformClient,
} from "../src/clients/turso";
import { db } from "../src/db";
import { users } from "../src/db/schema/auth";
import { databases } from "../src/db/schema/databases";
import { logger } from "../src/utils/logger";

/**
 * Refreshes an expired access token for a user database
 */
const refreshAccessToken = async (
  dbName: string,
  dbId: string
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
 * Script that applies all pending migrations to each user database.
 *
 * This script is idempotent - it will only apply migrations that haven't
 * been applied yet according to the migrations table in each database.
 */
const applyUserDbMigrations = async () => {
  logger.info("Starting migration application to user databases...");

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
        { email: user.email, user_id: user.id, db_name: userDb.db_name },
        "Processing user database..."
      );

      try {
        // Try to apply migrations with current token
        try {
          await applyAllNewMigrations({
            dbUrl: `libsql://${userDb.hostname}`,
            token: userDb.access_token,
            dbName: userDb.db_name,
          });

          logger.info(
            { email: user.email, user_id: user.id, db_name: userDb.db_name },
            "Successfully applied migrations to user database"
          );

          successCount++;
        } catch (err) {
          // Check if it's an auth error
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (errorMessage.includes("status 401")) {
            logger.info(
              { email: user.email, user_id: user.id, db_name: userDb.db_name },
              "Token appears to be expired, refreshing and retrying..."
            );

            // Refresh token and retry
            const newToken = await refreshAccessToken(
              userDb.db_name,
              userDb.db_id
            );

            await applyAllNewMigrations({
              dbUrl: `libsql://${userDb.hostname}`,
              token: newToken,
              dbName: userDb.db_name,
            });

            logger.info(
              { email: user.email, user_id: user.id, db_name: userDb.db_name },
              "Successfully applied migrations after token refresh"
            );

            successCount++;
          } else {
            // If it's not an auth error, rethrow
            throw err;
          }
        }
      } catch (err) {
        errorCount++;
        logger.error(
          {
            err,
            email: user.email,
            user_id: user.id,
            db_name: userDb.db_name,
          },
          "Failed to apply migrations for user. Skipping."
        );
      }
    }

    logger.info(
      {
        totalUsers: usersWithDb.length,
        successCount,
        errorCount,
      },
      "Migration application completed!"
    );
  } catch (error) {
    logger.error(error, "Migration application failed");
    process.exit(1);
  }
};

(async () => {
  try {
    await applyUserDbMigrations();
    logger.info("Migration script finished successfully");
  } catch (error) {
    console.error("Error applying migrations to user databases:", error);
    process.exit(1);
  }
})();
