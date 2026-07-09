/// <reference lib="webworker" />
// Import order matters: message-buffer registers its `message` listener
// synchronously, and imports evaluate before this module's body — so it's in
// place before the `/bundle` import below runs its top-level WASM `await`, and
// no client-port message posted during init is dropped.

// Import the `/bundle` entry, NOT `/vite` or `.`:
//  - `/vite` (used by the app's main-thread fallback) guards WASM init behind
//    `if (isWebWorker()) setupWebWorker()`: in a worker it assumes it's turso's
//    own threadpool worker and never builds the `Database` constructor.
//  - `.` (default) always inits but fetches the wasm by URL, which the Vite dev
//    server serves as index.html -> "expected magic word" compile error.
//  - `/bundle` is self-contained: no worker guard, inlines the wasm bytes, and
//    spawns its own pthread worker from a Blob URL. Works in a dedicated worker
//    in both dev and prod, and exposes the full sync API (pull/push).
import { connect, type Database } from "@tursodatabase/sync-wasm/bundle";
import {
  clearSyncMetadata,
  installLocalStorageShim,
} from "./localstorage-shim";
import { onClientPort } from "./message-buffer";
import {
  type ConnectParams,
  DATA_CHANGED_CHANNEL,
  type DbWorkerRequest,
  type DbWorkerResponse,
  type QueryParams,
  READY_ID,
} from "./protocol";

/**
 * The dedicated worker that owns the single sync-wasm `Database` for the whole
 * origin. OPFS grants the exclusive SyncAccessHandle to one worker browser-wide
 * (never the main thread or a SharedWorker), so keeping the connection here is
 * what lets every tab share it instead of fighting over the OPFS lock.
 *
 * The SharedWorker (db.shared-worker.ts) spawns exactly one of these and hands
 * it a `MessagePort` per tab. Each port is an independent RPC channel; the DB
 * and its init/sync state below are shared across all of them.
 */

let db: Database | null = null;
let connectPromise: Promise<void> | null = null;
// Single-flight pull/push: N tabs each run a background sync loop, but only one
// pull/push should hit the engine at a time.
let pullPromise: Promise<boolean> | null = null;
let pushPromise: Promise<void> | null = null;
let checkpointPromise: Promise<void> | null = null;

const dataChanged = new BroadcastChannel(DATA_CHANGED_CHANNEL);

// Coalesce bursts of writes (e.g. a batch insert) into one notification.
const NOTIFY_DEBOUNCE_MS = 250;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
const notifyDataChanged = () => {
  if (notifyTimer !== null) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    dataChanged.postMessage({ at: "worker" });
  }, NOTIFY_DEBOUNCE_MS);
};

const doConnect = async (params: ConnectParams) => {
  if (!connectPromise) {
    connectPromise = connect(params).then((connected) => {
      db = connected;
    });
  }
  await connectPromise;
};

const runQuery = async ({ sql, params, method }: QueryParams) => {
  if (!db) throw new Error("DB not connected");

  const stmt = db.prepare(sql);

  if (method === "run") {
    const result = await stmt.run(params);
    notifyDataChanged();
    return result ?? null;
  }

  if (method === "all") {
    return await stmt.all(params);
  }

  return (await stmt.get(params)) ?? null;
};

const doPull = () => {
  if (!db) throw new Error("DB not connected");
  if (!pullPromise) {
    pullPromise = db.pull().finally(() => {
      pullPromise = null;
    });
  }
  return pullPromise;
};

const doPush = () => {
  if (!db) throw new Error("DB not connected");
  if (!pushPromise) {
    pushPromise = db.push().finally(() => {
      pushPromise = null;
    });
  }
  return pushPromise;
};

const doCheckpoint = () => {
  if (!db) throw new Error("DB not connected");
  if (!checkpointPromise) {
    checkpointPromise = db.checkpoint().finally(() => {
      checkpointPromise = null;
    });
  }
  return checkpointPromise;
};

const deleteLocal = async (prefix: string) => {
  if (db) {
    await db.close();
    db = null;
    connectPromise = null;
  }

  const opfsRoot = await navigator.storage.getDirectory();
  const toDelete: string[] = [];
  // Cast: TS's lib doesn't type entries() on FileSystemDirectoryHandle.
  for await (const [name] of opfsRoot as unknown as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    if (name.startsWith(prefix)) toDelete.push(name);
  }
  for (const name of toDelete) {
    try {
      await opfsRoot.removeEntry(name);
    } catch {
      // File may still be locked; ignore.
    }
  }

  await clearSyncMetadata();
};

const handleRpc = async (request: DbWorkerRequest): Promise<unknown> => {
  switch (request.method) {
    case "connect":
      await doConnect(request.params);
      return null;
    case "query":
      return runQuery(request.params);
    case "exec": {
      if (!db) throw new Error("DB not connected");
      await db.exec(request.params.sql);
      return null;
    }
    case "pull": {
      const changed = await doPull();
      if (changed) notifyDataChanged();
      return changed;
    }
    case "push":
      await doPush();
      return null;
    case "checkpoint":
      await doCheckpoint();
      return null;
    case "close": {
      if (db) await db.close();
      db = null;
      connectPromise = null;
      return null;
    }
    case "deleteLocal":
      await deleteLocal(request.params.prefix);
      return null;
  }
};

const setupClientPort = (port: MessagePort) => {
  port.onmessage = async (event: MessageEvent<DbWorkerRequest>) => {
    const request = event.data;
    try {
      const result = await handleRpc(request);
      const response: DbWorkerResponse = { id: request.id, ok: true, result };
      port.postMessage(response);
    } catch (error) {
      const response: DbWorkerResponse = {
        id: request.id,
        ok: false,
        error: String(error),
      };
      port.postMessage(response);
    }
  };

  // The worker's onmessage below is only registered after top-level init
  // (WASM instantiate) completes, so by the time a client port is processed the
  // worker is ready — tell the tab it can start sending requests.
  const ready: DbWorkerResponse = { id: READY_ID, ok: true, result: "ready" };
  port.postMessage(ready);
};

// Metadata IO must be shimmed before any sync `connect` runs (see the shim
// module). Client ports that arrived during init were buffered by
// message-buffer; registering the handler now drains them and handles the rest.
await installLocalStorageShim();

onClientPort(setupClientPort);
