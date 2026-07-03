#!/usr/bin/env bun
import { createCLI } from "@bunli/core";
import packageJson from "../package.json";
import { dbInfoCommand } from "./commands/db-info";
import { loginCommand } from "./commands/login";
import { skillCommand } from "./commands/skill";
import { updateCommand } from "./commands/update";
import { checkForUpdate } from "./lib/update";

const cli = createCLI({
  name: "bahar",
  version: packageJson.version,
  description:
    "Query your Bahar dictionary and flashcard data from the command line",
});

cli.command(loginCommand);
cli.command(dbInfoCommand);
cli.command(updateCommand);
cli.command(skillCommand);

await checkForUpdate();

await cli.init();
await cli.run();
