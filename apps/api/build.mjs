import esbuild from "esbuild";
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import { esbuildPluginFilePathExtensions } from "esbuild-plugin-file-path-extensions";

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
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      debug: true,
      telemetry: false,
    }),
  ],
});
