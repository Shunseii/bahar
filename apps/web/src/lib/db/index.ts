import { connect, Database } from "@tursodatabase/sync-wasm/vite";
import { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { trpcClient } from "../trpc";
import { err, ok, tryCatch } from "../result";
import * as Sentry from "@sentry/react";

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
    throw new Error("Database not initialized.");
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
  if (db) return ok(null);

  const infoResult = await tryCatch(
    () => trpcClient.databases.userDatabase.query(),
    (error) => ({
      type: "get_db_info_failed",
      reason: String(error),
    }),
  );
  if (!infoResult.ok) return infoResult;

  const { access_token, hostname, db_name } = infoResult.value;

  const connectionResult = await tryCatch(
    () =>
      _connectToLocalDb({
        hostname,
        authToken: access_token,
        dbName: db_name,
      }),
    (error) => ({
      type: "db_connection_failed",
      reason: String(error),
    }),
  );

  if (!connectionResult.ok) {
    const refreshResult = await tryCatch(
      () => trpcClient.databases.refreshUserToken.mutate(),
      (error) => ({
        type: "token_refresh_failed",
        reason: String(error),
      }),
    );
    if (!refreshResult.ok) return refreshResult;

    const connectionAfterRefreshResult = await tryCatch(
      () =>
        _connectToLocalDb({
          hostname,
          authToken: refreshResult.value.access_token,
          dbName: db_name,
        }),
      (error) => ({
        type: "db_connection_failed_after_refresh",
        reason: String(error),
      }),
    );

    if (!connectionAfterRefreshResult.ok) return connectionAfterRefreshResult;

    db = connectionAfterRefreshResult.value;
  } else {
    db = connectionResult.value;
  }

  const migrationResult = await applyRequiredMigrations();
  if (!migrationResult.ok) return migrationResult;

  const syncResult = await tryCatch(
    async () => {
      await db!.pull();
      await db!.push();
    },
    (error) => ({
      type: "turso_remote_sync_failed",
      reason: String(error),
    }),
  );

  return syncResult;
};

/**
 * Executes any required migrations on the user database.
 * If a migration fails, it doesn't apply the rest.
 *
 * Records which migrations were applied in the database.
 * If there are any errors when recording the applied migrations,
 * it logs it in Sentry then continues applying the rest.
 *
 * If the latest migration is failing, it does not run
 * the rest of the migrations, if any.
 *
 * Note: all migrations must be idempotent otherwise
 * this logic will cause issues.
 */
const applyRequiredMigrations = async () => {
  if (!db) return ok(null);

  const latestMigrationStatus = await tryCatch(
    () => {
      return db!
        .prepare("SELECT * FROM migrations ORDER BY version DESC LIMIT 1;")
        .get() as Promise<SelectMigration>;
    },
    (error) => ({
      type: "latest_migration_status_query_failed",
      reason: String(error),
    }),
  );
  if (!latestMigrationStatus.ok) return latestMigrationStatus;

  if (latestMigrationStatus.value.status === "failed") {
    return err({
      type: "latest_migration_is_failing",
      reason:
        "The most recent migration for the client database had failed before. Must be fixed manually before proceeding with the remaining migrations.",
    });
  }

  const currentSchemaVersionResult = await getCurrentSchemaVersion();
  if (
    !currentSchemaVersionResult.ok &&
    currentSchemaVersionResult.error.type !== "migration_table_does_not_exist"
  ) {
    return err(currentSchemaVersionResult.error);
  }

  // Assume that if migration table doesn't exist, this is a fresh database
  // and we need to apply all migrations onto it.
  const currentSchemaVersion = currentSchemaVersionResult.ok
    ? currentSchemaVersionResult.value
    : 0;

  const verifySchemaResult = await tryCatch(
    () =>
      trpcClient.migrations.verifySchema.query({
        version: currentSchemaVersion,
      }),
    (error) => ({
      type: "api_schema_verification_failed",
      reason: String(error),
    }),
  );
  if (!verifySchemaResult.ok) return verifySchemaResult;

  const { status, requiredMigrations } = verifySchemaResult.value;

  if (status === "latest" || !requiredMigrations?.length) return ok(null);

  for (const migration of requiredMigrations) {
    const nowTimestampMs = Date.now();

    const execResult = await tryCatch(
      () => db!.exec(migration.sql_script),
      (error) => ({
        type: "migration_failed",
        reason: String(error),
      }),
    );

    if (!execResult.ok) {
      await tryCatch(
        () =>
          db!
            .prepare(
              "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
            )
            .run([
              migration.version,
              migration.description,
              nowTimestampMs,
              "failed",
            ]),
        (error) => {
          Sentry.logger.error("Failed to log failed migration", {
            migrationVersion: migration.version,
            reason: String(error),
          });
          return null;
        },
      );

      return execResult;
    }

    await tryCatch(
      () =>
        db!
          .prepare(
            "INSERT INTO migrations (version, description, applied_at_ms, status) VALUES (?, ?, ?, ?)",
          )
          .run([
            migration.version,
            migration.description,
            nowTimestampMs,
            "applied",
          ]),
      (error) => {
        Sentry.logger.error("Failed to log successful migration", {
          migrationVersion: migration.version,
          reason: String(error),
        });
        return null;
      },
    );
  }

  return ok(null);
};

const getCurrentSchemaVersion = async () => {
  if (!db) return err({ type: "db_not_initialized" });

  const tableExists = await tryCatch(
    async () => {
      const result = await db!
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';",
        )
        .get();

      return !!result;
    },
    () => ({ type: "check_migration_table_exists_query_failed" }),
  );

  if (!tableExists.ok) return tableExists;

  if (!tableExists.value)
    return err({ type: "migration_table_does_not_exist" });

  return tryCatch(
    async () => {
      const row: Pick<SelectMigration, "version"> | undefined = await db!
        .prepare(
          "SELECT version FROM migrations WHERE status = 'applied' ORDER BY version DESC LIMIT 1;",
        )
        .get();

      return row?.version ?? 0;
    },
    () => ({ type: "schema_version_query_failed" }),
  );
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
}) => {
  try {
    return connect({
      path: _formatLocalDbName(dbName),
      url: _formatDbUrl(hostname),
      authToken,
    });
  } catch (err) {
    console.error("Error connecting to local database: ", err);

    throw new Error("Unable to connect to local database.");
  }
};
