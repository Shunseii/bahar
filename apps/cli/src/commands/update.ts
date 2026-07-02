import { rename } from "node:fs/promises";
import { defineCommand } from "@bunli/core";
import packageJson from "../../package.json";
import {
  getAssetNameForPlatform,
  getLatestRelease,
  versionFromTag,
} from "../lib/update";

export const updateCommand = defineCommand({
  name: "update",
  description: "Update the Bahar CLI to the latest version",
  handler: async ({ colors, spinner }) => {
    const s = spinner();
    s.start("Checking for updates...");

    const release = await getLatestRelease();

    if (!release) {
      s.fail(
        colors.red("Could not check for updates. Please try again later.")
      );
      process.exitCode = 1;
      return;
    }

    const latestVersion = versionFromTag(release.tag_name);

    if (latestVersion === packageJson.version) {
      s.succeed("Already up to date.");
      return;
    }

    const assetName = getAssetNameForPlatform();
    const asset = release.assets.find((a) => a.name === assetName);

    if (!asset) {
      s.fail(colors.red(`No release found for your platform (${assetName}).`));
      process.exitCode = 1;
      return;
    }

    s.update(`Downloading ${latestVersion}...`);

    const binaryResponse = await fetch(asset.browser_download_url);
    const tempPath = `${process.execPath}.download`;

    await Bun.write(tempPath, binaryResponse);

    if (process.platform !== "win32") {
      await Bun.$`chmod +x ${tempPath}`.quiet();
    }

    await rename(tempPath, process.execPath);

    s.succeed(colors.green(`Updated to ${latestVersion}.`));
  },
});
