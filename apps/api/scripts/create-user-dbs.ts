import { db } from "../src/db";
import { users } from "../src/db/schema/auth";
import { databases } from "../src/db/schema/databases";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../src/logger";
import { setUpUserDb } from "../src/auth";

/**
 * Script that creates user databases in turso
 * for all users that don't have a user database
 * and applies all migrations to each one.
 */
const createUserDbs = async () => {
  logger.info("Starting user database creation...");

  try {
    const usersWithoutDb = await db
      .select()
      .from(users)
      .leftJoin(databases, eq(users.id, databases.user_id))
      .where(isNull(databases.db_id));

    logger.info(
      `Found ${usersWithoutDb.length} users without a user database.`,
    );

    for (const { users: user } of usersWithoutDb) {
      logger.info(
        { email: user.email, user_id: user.id },
        `Creating user database for user...`,
      );

      try {
        await setUpUserDb(user.id);

        logger.info(
          { email: user.email, user_id: user.id },
          `Successfully created user database for user.`,
        );
      } catch (err) {
        logger.error(
          {
            err,
            email: user.email,
            user_id: user.id,
          },
          `Failed to create user database for user. Skipping.`,
        );
      }
    }

    logger.info("Migration completed!");
  } catch (error) {
    logger.error(error, "Migration failed");
    process.exit(1);
  }
};

(async () => {
  try {
    await createUserDbs();
    logger.info("Migration script finished successfully");
  } catch (error) {
    console.error("Error creating user databases:", error);
    process.exit(1);
  }
})();
