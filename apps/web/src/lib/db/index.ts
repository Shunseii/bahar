import { connect, Database } from "@tursodatabase/sync-wasm/vite";
import { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { trpcClient } from "../trpc";
/**
 * Singleton database instance connected to
 * a local copy of the user's database that syncs
 * with the remote database in turso.
 *
 * Initially undefined, but we initialize it
 * in the pre load of the root router.
 */
let db: Database | null = null;

const LOCAL_DB_PATH_PREFIX = "bahar-local";

export const getDb = () => {
  if (!db) {
    throw new Error("Database not initialized. Call initDb first.");
  }

  return db;
};

export const resetDb = async () => {
  if (!db) return;

  await db.close();
  db = null;
};

/**
 * Initializes connection to the user's database
 * by querying the server for the connection information
 * then either creating or connecting to a local copy
 * of the database.
 *
 * Also runs an initial sync with remote and any new migrations.
 */
export const initDb = async () => {
  if (db) return;

  const { access_token, hostname, db_name } =
    await trpcClient.databases.userDatabase.query();

  try {
    const userDbClient = await _connectToLocalDb({
      hostname,
      authToken: access_token,
      dbName: db_name,
    });

    db = userDbClient;

    await applyRequiredMigrations();

    await db.pull();
    await db.push();
  } catch (err) {
    const refreshed = await trpcClient.databases.refreshUserToken.mutate();

    const reconnectedClient = await _connectToLocalDb({
      hostname,
      authToken: refreshed.access_token,
      dbName: db_name,
    });

    db = reconnectedClient;

    await db.pull();
    await db.push();
  }
};

/**
 * Executes any required migrations on the user database.
 */
const applyRequiredMigrations = async () => {
  if (!db) return;

  const currentSchemaVersion = await getCurrentSchemaVersion();

  if (!currentSchemaVersion) return;

  const { status, requiredMigrations } =
    await trpcClient.migrations.verifySchema.query({
      version: currentSchemaVersion,
    });

  if (status === "latest" || !requiredMigrations?.length) return;

  for (const migration of requiredMigrations) {
    const nowTimestampMs = Date.now();

    try {
      await db.exec(migration.sql_script);

      await db
        .prepare(
          "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
        )
        .run([
          migration.version,
          migration.description,
          nowTimestampMs,
          "applied",
        ]);
    } catch (err) {
      await db
        .prepare(
          "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
        )
        .run([
          migration.version,
          migration.description,
          nowTimestampMs,
          "failed",
        ]);

      break;
    }
  }
};

/**
 * @returns The current version of the local user database schema.
 */
const getCurrentSchemaVersion = async () => {
  if (!db) return undefined;

  try {
    const result: Pick<SelectMigration, "version"> | undefined = await db
      .prepare(
        "SELECT version FROM migrations WHERE status = 'applied' ORDER BY version DESC LIMIT 1;",
      )
      .get();

    return result?.version ?? 0;
  } catch (err) {
    // Assuming that this is a fresh database

    return 0;
  }
};

const _formatDbUrl = (hostname: string) => `libsql://${hostname}`;

const _formatLocalDbName = (dbName: string) =>
  `${LOCAL_DB_PATH_PREFIX}-${dbName}.db`;

const _connectToLocalDb = async ({
  hostname,
  authToken,
  dbName,
}: {
  hostname: string;
  authToken: string;
  dbName: string;
}) =>
  connect({
    path: _formatLocalDbName(dbName),
    url: _formatDbUrl(hostname),
    authToken,
  });
