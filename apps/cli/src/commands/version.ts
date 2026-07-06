import { defineCommand } from "@bunli/core";
import { CLI_VERSION } from "../lib/config";

export const versionCommand = defineCommand({
  name: "version",
  description: "Print the CLI version",
  handler: () => {
    console.log(CLI_VERSION);
  },
});
