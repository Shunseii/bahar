import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "./index.js";

(async () => {
  console.log("Running migrations...");

  // This will run migrations on the database, skipping the ones already applied
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations run successfully!");

  // Don't forget to close the connection, otherwise the script will hang
  client.close();
})();
