import { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { ensureDb } from "..";
import { TableOperation } from "./types";

export const migrationTable = {
  latestMigration: {
    query: async (): Promise<SelectMigration> => {
      try {
        const db = await ensureDb();
        const res: SelectMigration = await db
          .prepare("SELECT * FROM migrations ORDER BY version DESC LIMIT 1;")
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
