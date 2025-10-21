import { connect, Database } from "@tursodatabase/sync-wasm/vite";
import { SelectMigration, SelectSetting } from "@bahar/drizzle-user-db-schemas";
import { trpcClient } from "../trpc";
import { RawSetting } from "@bahar/drizzle-user-db-schemas/src/settings";

/**
 * Singleton database instance connected to
 * a local copy of the user's database that syncs
 * with the remote database in turso.
 *
 * Initially undefined, but we initialize it
 * in the pre load of the root router.
 */
export let db: Database;

const LOCAL_DB_PATH = "local.db";

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

  const { access_token, hostname } =
    await trpcClient.databases.userDatabase.query();

  try {
    const userDbClient = await _connectToLocalDb({
      hostname,
      authToken: access_token,
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
  const currentSchemaVersion = await getCurrentSchemaVersion();

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

type TableOperation = {
  // Note: can't use a generic here to type the output
  // it will still be any when used with satisfies
  query?: () => Promise<unknown>;
  mutation?: () => Promise<unknown>;
  /**
   * The cache options for the query in tanstack query.
   */
  cacheOptions: {
    // Prefix with turso to ensure there's no conflict
    // with trpc query keys.
    queryKey: `turso.${string}`[];
    staleTime?: number;
  };
};

export const settingsTable = {
  getSettings: {
    query: async (): Promise<Omit<SelectSetting, "id">> => {
      const res: RawSetting = await db.prepare("SELECT * FROM settings").get();

      return {
        show_antonyms_in_flashcard: res.show_antonyms_in_flashcard,
        show_reverse_flashcards: Boolean(res.show_reverse_flashcards),
      };
    },
    cacheOptions: {
      queryKey: ["turso.settings.query"],
      staleTime: Infinity,
    },
  },
} satisfies Record<string, TableOperation>;

const _formDbUrl = (hostname: string) => `libsql://${hostname}`;

const _connectToLocalDb = async ({
  hostname,
  authToken,
}: {
  hostname: string;
  authToken: string;
}) => connect({ path: LOCAL_DB_PATH, url: _formDbUrl(hostname), authToken });
