import type * as schema from "@bahar/drizzle-user-db-schemas";
import type { drizzle } from "drizzle-orm/sqlite-proxy";

/**
 * The drizzle instance every operation runs against. All three adapters --
 * web (sync-wasm), mobile (sync-react-native), and the test harness
 * (@tursodatabase/sync) -- build this via `drizzle-orm/sqlite-proxy`, so the
 * type is identical across platforms and the operations don't care which
 * engine backs it.
 */
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Everything an operations factory needs from its host app, injected rather
 * than imported so the same operation code runs unchanged on web, mobile, and
 * the test harness.
 *
 * Only `getDb` is injected: it's the one thing that genuinely differs per
 * platform (each app wires its own DB singleton init; the harness hands back
 * an in-memory test db). The write queue lives in this package (see
 * ./queue) and is imported directly by the operations, since it's identical
 * everywhere apart from its error logger, which apps set via configureDbQueue.
 */
export interface OperationDeps {
  getDb: () => Promise<DrizzleDb>;
}
