import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "@bunli/core";
import skillContent from "../../skill/SKILL.md" with { type: "text" };

const skillPath = (): string =>
  join(homedir(), ".claude", "skills", "bahar-data-access", "SKILL.md");

const skillInstallCommand = defineCommand({
  name: "install",
  description: "Install the bahar-data-access Claude Code skill",
  handler: async ({ colors }) => {
    const path = skillPath();

    await Bun.write(path, skillContent);

    console.log(
      colors.green(`Installed the bahar-data-access skill to ${path}`)
    );
  },
});

export const skillCommand = defineCommand({
  name: "skill",
  description: "Manage the bahar-data-access Claude Code skill",
  commands: [skillInstallCommand],
});
