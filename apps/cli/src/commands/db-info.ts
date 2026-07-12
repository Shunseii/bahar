import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { loadCredentials } from "../lib/credentials";
import { getUserDbInfo } from "../lib/db";

export const dbInfoCommand = defineCommand({
  name: "db-info",
  description:
    "Print connection info (hostname, db name, access token) for your personal database",
  options: {
    refresh: option(z.coerce.boolean().optional().default(false), {
      short: "r",
      description:
        "Bypass the local cache and fetch a fresh token from the API.",
    }),
  },
  handler: async ({ flags, colors }) => {
    const credentials = await loadCredentials();

    if (!credentials) {
      console.error(colors.red("Not logged in. Run `bahar login` first."));
      process.exitCode = 1;
      return;
    }

    try {
      const info = await getUserDbInfo({
        token: credentials.token,
        forceRefresh: flags.refresh,
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
