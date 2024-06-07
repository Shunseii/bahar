import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  driver: "turso",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // authToken: ""
  },
} satisfies Config;
