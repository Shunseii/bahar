import { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { getDb } from "..";
import { TableOperation } from "../operations";

export const migrationTable = {
  latestMigration: {
    query: async (): Promise<SelectMigration> => {
      try {
        const db = getDb();
        const res: SelectMigration = await db
          .prepare(
            "SELECT version FROM migrations ORDER BY version DESC LIMIT 1;",
          )
          .get();

        return res;
      } catch (err) {
        console.error("Error querying latest migration", err);
        throw err;
      }
    },
    cacheOptions: {
      queryKey: ["turso.schema.latestMigration"],
    },
  },
} satisfies Record<string, TableOperation>;
