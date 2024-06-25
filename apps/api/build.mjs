import esbuild from "esbuild";
import { esbuildPluginFilePathExtensions } from "esbuild-plugin-file-path-extensions";

await esbuild.build({
  format: "esm",
  entryPoints: ["./src/**/*.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  packages: "external",
  platform: "node",
  plugins: [esbuildPluginFilePathExtensions()],
});
