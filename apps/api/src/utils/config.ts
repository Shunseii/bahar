import { z } from "zod";

const EnvironmentVariablesSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.string().default("3000").transform(Number),
  HOST: z.string().default("localhost"),

  /**
   * The domain of the web client.
   */
  WEB_CLIENT_DOMAIN: z.string(),

  /**
   * The domain of the server.
   */
  APP_DOMAIN: z.string().min(1),

  LOG_LEVEL: z
    .enum(["silent", "fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  APP_NAME: z.string().min(1),

  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),

  RESEND_API_KEY: z.string().min(1),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  DATABASE_URL: z.string().url(),
  TURSO_TOKEN: z.string(),
  TURSO_PLATFORM_API_KEY: z.string(),
  TURSO_ORG_SLUG: z.string(),
  TURSO_DB_GROUP: z.string(),

  BETTER_AUTH_SECRET: z.string().min(1),

  SENTRY_DSN: z.string().min(1),
  SENTRY_ENV: z.enum(["production", "local"]),

  POLAR_ACCESS_TOKEN: z.string().min(1),
  POLAR_WEBHOOK_SECRET: z.string().min(1),
  POLAR_PRO_PRODUCT_ID: z.string().min(1),
  POLAR_PRO_ANNUAL_PRODUCT_ID: z.string().min(1),
});

export type EnvironmentVariables = z.infer<typeof EnvironmentVariablesSchema>;

const validateEnv = () => {
  const result = EnvironmentVariablesSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "❌ Error starting server, invalid environment variables:",
      result.error.flatten().fieldErrors
    );

    process.exit(1);
  }

  return result.data;
};

const config = validateEnv();

export { config };
