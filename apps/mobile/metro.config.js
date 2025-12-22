// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const path = require("path");

// First apply monorepo paths
const baseConfig = withMonorepoPaths(getDefaultConfig(__dirname));

// Add Lingui extensions
baseConfig.resolver.sourceExts = [...baseConfig.resolver.sourceExts, "po", "pot"];

// XXX: Resolve our exports in workspace packages
// https://github.com/expo/expo/issues/26926
// Also needed for better auth:
// https://www.better-auth.com/docs/integrations/expo#configure-metro-bundler
baseConfig.resolver.unstable_enablePackageExports = true;

// Apply Uniwind config
const config = withUniwindConfig(baseConfig, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});

module.exports = config;

/**
 * Add the monorepo paths to the Metro config.
 * This allows Metro to resolve modules from the monorepo.
 *
 * @see https://docs.expo.dev/guides/monorepos/#modify-the-metro-config
 * @param {import('expo/metro-config').MetroConfig} config
 * @returns {import('expo/metro-config').MetroConfig}
 */
function withMonorepoPaths(config) {
  const projectRoot = __dirname;
  const workspaceRoot = path.resolve(projectRoot, "../..");

  // #1 - Watch all files in the monorepo
  config.watchFolders = [workspaceRoot];

  // #2 - Resolve modules within the project's `node_modules` first, then all monorepo modules
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ];

  return config;
}
