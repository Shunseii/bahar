import { defineCommand } from "@bunli/core";
import { API_URL } from "../lib/config";
import { loadCredentials } from "../lib/credentials";

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

    if (!response.ok) {
      console.error(
        colors.red(`Failed to fetch database info (${response.status}).`)
      );
      process.exitCode = 1;
      return;
    }

    console.log(JSON.stringify(await response.json(), null, 2));
  },
});
