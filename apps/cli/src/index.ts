#!/usr/bin/env bun
import { createCLI } from "@bunli/core";
import { dbInfoCommand } from "./commands/db-info";
import { gradeCommand } from "./commands/grade";
import { loginCommand } from "./commands/login";
import { skillCommand } from "./commands/skill";
import { updateCommand } from "./commands/update";
import { versionCommand } from "./commands/version";
import { CLI_VERSION } from "./lib/config";
import { checkForUpdate } from "./lib/update";

const argv = process.argv.slice(2);

if (
  argv[0] === "version" ||
  argv.includes("--version") ||
  argv.includes("-v")
) {
  console.log(CLI_VERSION);
  process.exit(0);
}

const cli = createCLI({
  name: "bahar",
  version: CLI_VERSION,
  description:
    "Query your Bahar dictionary and flashcard data from the command line",
});

cli.command(loginCommand);
cli.command(dbInfoCommand);
cli.command(gradeCommand);
cli.command(updateCommand);
cli.command(skillCommand);
cli.command(versionCommand);

await checkForUpdate();

await cli.init();

// `bahar help` mirrors the built-in `--help` output.
await cli.run(argv[0] === "help" ? ["--help"] : undefined);
