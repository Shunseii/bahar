import type { SelectMigration } from "@bahar/drizzle-user-db-schemas";
import { ensureDb } from "..";
import type { TableOperation } from "./types";

export const migrationTable = {
  latestMigration: {
    query: async (): Promise<SelectMigration> => {
      const db = await ensureDb();
      const res: SelectMigration = await db
        .prepare("SELECT * FROM migrations ORDER BY version DESC LIMIT 1;")
        .get();

      return res;
    },
    cacheOptions: {
      queryKey: ["turso.schema.latestMigration"],
    },
  },
} satisfies Record<string, TableOperation>;
