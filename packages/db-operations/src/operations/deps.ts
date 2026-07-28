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
 * than imported so the same operation code runs unchanged on web, mobile, the
 * test harness, and the API.
 *
 * `getDb` is the one thing that genuinely differs per platform (each app wires
 * its own DB singleton init; the harness hands back an in-memory test db).
 * `enqueue` defaults to this package's own write queue (see ./queue) and only
 * needs overriding by a host where that queue is wrong -- see its doc below.
 */
export interface OperationDeps {
  getDb: () => Promise<DrizzleDb>;
  /**
   * Wraps every mutation. Defaults to {@link enqueueDbOperation}, the
   * process-wide serial queue that keeps concurrent writes from tripping
   * "database is busy" on a local SQLite file.
   *
   * The API overrides this with a pass-through: it writes to a remote libsql
   * database over HTTP, which has no such constraint, and its queue would be a
   * single global lane shared by every user's request.
   */
  enqueue?: <T>(operation: () => Promise<T>) => Promise<T>;
}
