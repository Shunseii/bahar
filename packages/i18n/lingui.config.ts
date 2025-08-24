import type { LinguiConfig } from "@lingui/conf";
import path from "path";
import { fileURLToPath } from "url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

const config: LinguiConfig = {
  sourceLocale: "en",
  locales: ["en", "ar"],
  catalogs: [
    {
      path: path.join(packageDir, "locales/{locale}"),
      include: [
        "<rootDir>/../../apps/web/src",
        "<rootDir>/../../apps/mobile/src",
      ],
    },
  ],
};

export default config;
