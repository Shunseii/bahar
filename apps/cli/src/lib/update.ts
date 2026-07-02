import { join } from "node:path";
import { colors } from "@bunli/utils";
import packageJson from "../../package.json";
import { GITHUB_REPO } from "./config";
import { configDir } from "./credentials";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLI_TAG_PREFIX = "cli-v";

interface UpdateCheckState {
  lastCheckedAt: number;
}

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  assets: { name: string; browser_download_url: string }[];
}

const stateFilePath = (): string => join(configDir(), "update-check.json");

const readState = async (): Promise<UpdateCheckState | null> => {
  const file = Bun.file(stateFilePath());

  if (!(await file.exists())) {
    return null;
  }

  return (await file.json()) as UpdateCheckState;
};

const writeState = async (state: UpdateCheckState): Promise<void> => {
  await Bun.write(stateFilePath(), JSON.stringify(state));
};

/**
 * This is a monorepo — web/mobile publish their own `v*`-tagged releases,
 * so `/releases/latest` would return whichever of those is newest instead
 * of the latest CLI release. List releases and find the newest `cli-v*` one.
 */
export const getLatestRelease = async (): Promise<GithubRelease | null> => {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`,
    { signal: AbortSignal.timeout(5000) }
  );

  if (!response.ok) {
    return null;
  }

  const releases = (await response.json()) as GithubRelease[];

  return (
    releases.find(
      (release) => !release.draft && release.tag_name.startsWith(CLI_TAG_PREFIX)
    ) ?? null
  );
};

export const versionFromTag = (tagName: string): string =>
  tagName.startsWith(CLI_TAG_PREFIX)
    ? tagName.slice(CLI_TAG_PREFIX.length)
    : tagName;

export const getAssetNameForPlatform = (): string => {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "bahar-darwin-arm64" : "bahar-darwin-x64";
  }

  if (process.platform === "win32") {
    return "bahar-windows-x64.exe";
  }

  return "bahar-linux-x64";
};

/**
 * Notify-only check, run on every invocation. Never throws — a failed
 * or rate-limited check should never block the command the user asked for.
 */
export const checkForUpdate = async (): Promise<void> => {
  try {
    const state = await readState();

    if (state && Date.now() - state.lastCheckedAt < CHECK_INTERVAL_MS) {
      return;
    }

    await writeState({ lastCheckedAt: Date.now() });

    const release = await getLatestRelease();

    if (!release) {
      return;
    }

    const latestVersion = versionFromTag(release.tag_name);

    if (latestVersion !== packageJson.version) {
      console.log(
        colors.yellow(
          `A new version of the Bahar CLI is available (${latestVersion}). Run \`bahar update\` to upgrade.`
        )
      );
    }
  } catch {
    // Update checks should never block usage.
  }
};
