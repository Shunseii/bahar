import packageJson from "../../package.json";

export const API_URL = process.env.BAHAR_API_URL ?? "http://localhost:3000";
export const WEB_URL = process.env.BAHAR_WEB_URL ?? "http://localhost:5173";

export const GITHUB_REPO = "Shunseii/bahar";

/**
 * package.json's version is a static placeholder — release binaries get the
 * real version baked in at compile time (from the cli-v* tag) via --define,
 * since nothing else keeps package.json in sync with what's actually tagged.
 */
export const CLI_VERSION = process.env.BAHAR_CLI_VERSION ?? packageJson.version;
