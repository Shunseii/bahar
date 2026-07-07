import {
  migrations,
  type SelectMigration,
} from "@bahar/drizzle-user-db-schemas";
import { desc } from "drizzle-orm";
import type { TableOperation } from "../types";
import type { OperationDeps } from "./deps";

export const makeMigrationTable = ({ getDb }: OperationDeps) =>
  ({
    latestMigration: {
      query: async (): Promise<SelectMigration> => {
        const drizzleDb = await getDb();

        const [res] = await drizzleDb
          .select()
          .from(migrations)
          .orderBy(desc(migrations.version))
          .limit(1);

        return res;
      },
      cacheOptions: {
        queryKey: ["turso.schema.latestMigration"],
      },
    },
  }) satisfies Record<string, TableOperation>;
