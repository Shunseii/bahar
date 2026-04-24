import type { ConfigContext, ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

const getUniqueIdentifier = () =>
  IS_DEV ? "dev.bahar.app.dev" : "dev.bahar.app";

const getAppName = () => (IS_DEV ? "Bahar (Dev)" : "Bahar");

const getLocales = () =>
  IS_DEV
    ? {
        en: "./languages/english-dev.json",
        ar: "./languages/arabic-dev.json",
      }
    : {
        en: "./languages/english.json",
        ar: "./languages/arabic.json",
      };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: getAppName(),
  ios: {
    ...config.ios,
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    ...config.android,
    package: getUniqueIdentifier(),
  },
  locales: getLocales(),
});
