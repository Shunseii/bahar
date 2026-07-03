export const API_URL = process.env.BAHAR_API_URL ?? "http://localhost:3000";
export const WEB_URL = process.env.BAHAR_WEB_URL ?? "http://localhost:5173";

export const GITHUB_REPO = "Shunseii/bahar";

/**
 * Release binaries get the real version baked in at compile time (from the
 * cli-v* tag) via --define. Nothing keeps package.json's version in sync
 * with what's actually tagged, so local/dev runs just report "dev".
 */
export const CLI_VERSION = process.env.BAHAR_CLI_VERSION ?? "dev";
