import { defineConfig } from "@julr/vite-plugin-validate-env";
import { z } from "zod";

export default defineConfig({
  validator: "zod",
  schema: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    PORT: z.string().transform(Number).default("4000"),

    VITE_API_BASE_URL: z.string().optional(),

    VITE_SENTRY_DSN: z.string().optional(),
    VITE_SENTRY_ENV: z.enum(["local", "production"]).optional(),
  },
});
