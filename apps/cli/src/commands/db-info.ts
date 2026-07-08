import { defineCommand } from "@bunli/core";
import { API_URL } from "../lib/config";
import { loadCredentials } from "../lib/credentials";
import { readJsonResponse } from "../lib/http";

export const dbInfoCommand = defineCommand({
  name: "db-info",
  description:
    "Print connection info (hostname, db name, access token) for your personal database",
  handler: async ({ colors }) => {
    const credentials = await loadCredentials();

    if (!credentials) {
      console.error(colors.red("Not logged in. Run `bahar login` first."));
      process.exitCode = 1;
      return;
    }

    const response = await fetch(new URL("/databases/user", API_URL), {
      headers: { "x-api-key": credentials.token },
    });

    try {
      const info = await readJsonResponse<unknown>({
        response,
        context: "Fetching database info",
      });
      console.log(JSON.stringify(info, null, 2));
    } catch (error) {
      console.error(
        colors.red(error instanceof Error ? error.message : String(error))
      );
      process.exitCode = 1;
    }
  },
});
