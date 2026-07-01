import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { setUpUserDb } from "../src/auth";
import { db } from "../src/db";
import { users } from "../src/db/schema/auth";
import { logger } from "../src/utils/logger";

const DEFAULT_NAME = "Admin";

/**
 * Creates a local dev admin account without going through the email-OTP
 * sign-up flow, and provisions its per-user Turso database. Pass a real
 * email you can receive mail at — sign-up email/password is disabled, so
 * logging into the app still goes through the normal `/sign-in/email-otp`
 * flow with this same address; that flow authenticates the existing user
 * without resetting its role. Safe to re-run — if the email already
 * exists, it's just (re-)promoted to admin.
 */
const createAdminUser = async () => {
  const email = process.argv[2];

  if (!email) {
    throw new Error(
      "Usage: tsx --env-file=.env scripts/create-admin-user.ts <email>"
    );
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (existing) {
    await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.id, existing.id));

    logger.info(
      { email, userId: existing.id },
      "User already existed, promoted to admin."
    );
    return;
  }

  const userId = nanoid();

  await db.insert(users).values({
    id: userId,
    email,
    name: DEFAULT_NAME,
    emailVerified: true,
    role: "admin",
  });

  logger.info(
    { email, userId },
    "Created admin user, provisioning database..."
  );

  await setUpUserDb(userId);

  logger.info({ email, userId }, "Admin user ready.");
};

(async () => {
  try {
    await createAdminUser();
    process.exit(0);
  } catch (error) {
    logger.error(error, "Failed to create admin user");
    process.exit(1);
  }
})();
