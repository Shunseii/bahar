import esbuild from "esbuild";
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import { esbuildPluginFilePathExtensions } from "esbuild-plugin-file-path-extensions";

console.log("Sentry Config:", {
  authToken: process.env.SENTRY_API_AUTH_TOKEN ? "present" : "missing",
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_API_PROJECT,
  sha: process.env.GITHUB_SHA,
});

await esbuild.build({
  sourcemap: true,
  format: "esm",
  entryPoints: ["./src/index.ts", "./src/db/migrate.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  packages: "external",
  platform: "node",
  plugins: [
    esbuildPluginFilePathExtensions({ filter: /\.(ts|tsx)$/ }),

    // Put the Sentry esbuild plugin after all other plugins
    sentryEsbuildPlugin({
      authToken: process.env.SENTRY_API_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_API_PROJECT,
      release: {
        name: process.env.GITHUB_SHA, // Only release during CI deployment
      },
      debug: true,
      telemetry: false,
    }),
  ],
});
