# Logs

Where logs are used, ensure Sentry is imported using `import * as Sentry from "@sentry/react"`
Enable logging in Sentry using `Sentry.init({ enableLogs: true })`
Sentry offers a `consoleLoggingIntegration` that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

The Sentry initialization needs to be updated to enable the logs feature.

### Baseline

```typescript
Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
  // Enable logs to be sent to Sentry
  enableLogs: true,
});
```

### Logger Integration

```typescript
Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
  integrations: [
    // send console.log, console.error, and console.warn calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
  ],
});
```

## Logger Examples

`Sentry.logger.fmt` is a template literal function that should be used to bring variables into the structured logs.

```typescript
import * as Sentry from "@sentry/react";
Sentry.logger.trace("Starting database connection", { database: "users" });
Sentry.logger.debug(Sentry.logger.fmt`Cache miss for user: ${userId}`);
Sentry.logger.info("Updated profile", { profileId: 345 });
Sentry.logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
Sentry.logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
Sentry.logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
```
