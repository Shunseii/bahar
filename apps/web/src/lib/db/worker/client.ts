import type { Database } from "@tursodatabase/sync-wasm/vite";
import {
  DATA_CHANGED_CHANNEL,
  type DbWorkerRequest,
  type DbWorkerResponse,
  type NewClientMessage,
  READY_ID,
  RELAY_CHANNEL,
  type RelayMessage,
} from "./protocol";

/**
 * Main-thread client for the shared local DB.
 *
 * OPFS SyncAccessHandles are only available in a dedicated worker, and a
 * SharedWorker can't spawn one — so instead of sharing a worker, tabs share a
 * single connection via leader election:
 *
 *   - Every tab requests one exclusive Web Lock. The holder is the leader; it
 *     spawns the dedicated DB worker (window -> Worker is supported everywhere)
 *     and answers RPC for all tabs over a BroadcastChannel.
 *   - Followers don't open the DB; they relay RPC to the leader and await the
 *     response. Only the leader touches OPFS, so tabs never fight the lock.
 *   - When the leader tab closes its Web Lock releases, a follower's queued
 *     request wins, and it becomes the leader (spawns its own worker).
 *
 * `getDbWorkerClient()` exposes a `Database`-shaped proxy so `getDb()` callers
 * and `buildDrizzleDb` work unchanged; every method routes through `rpc()`,
 * which picks the local-worker path (leader) or the relay path (follower).
 */

/** Requires Web Locks + BroadcastChannel + Worker. Present on every modern
 * browser incl. iOS Safari 15.4+. Older browsers fall back to a direct in-tab
 * connection (single-tab) — see index.ts. */
export const isSharedDbSupported = () =>
  typeof Worker !== "undefined" &&
  typeof BroadcastChannel !== "undefined" &&
  typeof navigator !== "undefined" &&
  typeof navigator.locks !== "undefined";

const LEADER_LOCK = "bahar-db-leader";

/**
 * How long to wait for the dedicated worker to signal ready before giving up.
 * The worker can stall indefinitely during init (e.g. its `/bundle` WASM
 * pthread never completes its `loaded` handshake in some production bundles),
 * and that throws nothing — so without this timeout the whole DB init hangs and
 * the app is stuck on the splash. On timeout we reject so callers fall back to a
 * direct in-tab connection instead of waiting forever.
 */
const WORKER_READY_TIMEOUT_MS = 10_000;

// ---- Dedicated worker (leader only) --------------------------------------

const waitForReady = (worker: Worker, port: MessagePort) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("DB worker did not signal ready before timeout"));
    }, WORKER_READY_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      port.removeEventListener("message", onReady);
      worker.removeEventListener("error", onError);
    };

    const onReady = (event: MessageEvent<DbWorkerResponse>) => {
      if (event.data.id !== READY_ID) return;
      cleanup();
      resolve();
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(`DB worker error: ${event.message || "unknown"}`));
    };

    port.addEventListener("message", onReady);
    worker.addEventListener("error", onError);
    port.start();
  });

const createWorkerRpc = (port: MessagePort) => {
  let nextId = 0;

  return (method: DbWorkerRequest["method"], params: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      const onMessage = (event: MessageEvent<DbWorkerResponse>) => {
        if (event.data.id !== id) return;
        port.removeEventListener("message", onMessage);
        if (event.data.ok) resolve(event.data.result);
        else reject(new Error(event.data.error));
      };
      port.addEventListener("message", onMessage);
      port.postMessage({ id, method, params } as DbWorkerRequest);
    });
};

type WorkerRpc = ReturnType<typeof createWorkerRpc>;

const spawnWorkerRpc = async (): Promise<WorkerRpc> => {
  const worker = new Worker(new URL("./db.worker.ts", import.meta.url), {
    type: "module",
    name: "bahar-db",
  });

  const channel = new MessageChannel();
  const port = channel.port2;
  const ready = waitForReady(worker, port);

  const newClient: NewClientMessage = { type: "client" };
  worker.postMessage(newClient, [channel.port1]);

  try {
    await ready;
  } catch (error) {
    worker.terminate();
    throw error;
  }

  return createWorkerRpc(port);
};

// ---- Cross-tab RPC (leader election + relay) -----------------------------

type PendingRequest = {
  method: DbWorkerRequest["method"];
  params: unknown;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const relay = isSharedDbSupported()
  ? new BroadcastChannel(RELAY_CHANNEL)
  : null;
const tabId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());

let role: "leader" | "follower" | null = null;
let workerRpc: WorkerRpc | null = null;
let requestCounter = 0;
const pending = new Map<string, PendingRequest>();

let resolveRoleReady: () => void;
let rejectRoleReady: (error: Error) => void;
const roleReady = new Promise<void>((resolve, reject) => {
  resolveRoleReady = resolve;
  rejectRoleReady = reject;
});

const post = (message: RelayMessage) => relay?.postMessage(message);

/** Runs a follower's queued requests against whichever worker now serves. */
const flushPending = (send: (request: PendingRequest, id: string) => void) => {
  for (const [id, request] of pending) send(request, id);
};

const becomeLeader = async () => {
  try {
    workerRpc = await spawnWorkerRpc();
  } catch (error) {
    // The worker never came up. Reject role readiness so `establish` (and thus
    // `initDb`) fails fast and callers fall back to a direct connection, then
    // rethrow to release the Web Lock so another tab can attempt the election.
    rejectRoleReady(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
  role = "leader";

  // Serve follower requests off the relay.
  relay?.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
    const message = event.data;
    if (message.kind === "whos-leader") {
      post({ kind: "leader-online" });
      return;
    }
    if (message.kind !== "request") return;

    workerRpc?.(message.method, message.params).then(
      (result) =>
        post({
          kind: "response",
          requestId: message.requestId,
          to: message.from,
          ok: true,
          result,
        }),
      (error: Error) =>
        post({
          kind: "response",
          requestId: message.requestId,
          to: message.from,
          ok: false,
          error: String(error),
        })
    );
  });

  post({ kind: "leader-online" });
  resolveRoleReady();

  // Requests this tab queued while it was a follower now run locally.
  flushPending((request, id) => {
    pending.delete(id);
    workerRpc?.(request.method, request.params).then(
      request.resolve,
      request.reject
    );
  });
};

const startLeaderElection = () => {
  // The request queues until whichever tab currently holds the lock releases it
  // (on tab close). The callback holds the lock for this tab's whole lifetime.
  navigator.locks
    .request(LEADER_LOCK, { mode: "exclusive" }, async () => {
      await becomeLeader();
      // Hold the lock for this tab's whole lifetime; it releases on tab unload,
      // letting another tab win the election and take over as leader.
      await new Promise<never>(() => {
        // never resolves
      });
    })
    // becomeLeader rethrows on worker failure to release the lock; it has
    // already rejected roleReady so callers fall back. Swallow the released-lock
    // rejection here so it isn't reported as an unhandled promise rejection.
    .catch(() => {});
};

const onRelayMessageAsFollower = (event: MessageEvent<RelayMessage>) => {
  const message = event.data;

  if (message.kind === "response" && message.to === tabId) {
    const request = pending.get(message.requestId);
    if (!request) return;
    pending.delete(message.requestId);
    if (message.ok) request.resolve(message.result);
    else request.reject(new Error(message.error));
    return;
  }

  if (message.kind === "leader-online") {
    if (role === null) {
      role = "follower";
      resolveRoleReady();
    }
    // A (possibly new) leader is serving — (re)send anything still pending. Safe
    // for reads; a write re-sent across a mid-request leader change could apply
    // twice (rare; the DB write queue serializes the common path).
    if (role === "follower") {
      flushPending((request, id) =>
        post({
          kind: "request",
          requestId: id,
          from: tabId,
          method: request.method,
          params: request.params,
        })
      );
    }
  }
};

let started = false;
const start = () => {
  if (started || !relay) return;
  started = true;
  relay.addEventListener("message", onRelayMessageAsFollower);
  startLeaderElection();
  // Discover an existing leader; if none, our election above wins shortly.
  post({ kind: "whos-leader" });
};

const rpc = async (method: DbWorkerRequest["method"], params: unknown) => {
  await roleReady;

  if (role === "leader") {
    if (!workerRpc) throw new Error("Leader worker not initialized");
    return workerRpc(method, params);
  }

  const requestId = `${tabId}:${requestCounter++}`;
  return new Promise<unknown>((resolve, reject) => {
    pending.set(requestId, { method, params, resolve, reject });
    post({ kind: "request", requestId, from: tabId, method, params });
  });
};

// ---- Database proxy ------------------------------------------------------

const createDbProxy = (): Database => {
  const proxy = {
    prepare: (sql: string) => ({
      run: (params: unknown[] = []) =>
        rpc("query", { sql, params, method: "run" }),
      all: (params: unknown[] = []) =>
        rpc("query", { sql, params, method: "all" }),
      get: (params: unknown[] = []) =>
        rpc("query", { sql, params, method: "get" }),
    }),
    exec: (sql: string) => rpc("exec", { sql }),
    pull: () => rpc("pull", undefined),
    push: () => rpc("push", undefined),
    checkpoint: () => rpc("checkpoint", undefined),
    close: () => rpc("close", undefined),
    // Mirrors sync-wasm's own Database.transaction: wrap fn in BEGIN/COMMIT and
    // ROLLBACK on throw. The wrapping exec and fn's inner prepare().run() calls
    // all route to the one worker-owned connection, so the whole thing is a real
    // transaction on that connection -- no separate transaction RPC needed.
    transaction:
      (fn: (...args: unknown[]) => Promise<unknown>) =>
      async (...args: unknown[]) => {
        await proxy.exec("BEGIN");
        try {
          const result = await fn(...args);
          await proxy.exec("COMMIT");
          return result;
        } catch (err) {
          await proxy.exec("ROLLBACK");
          throw err;
        }
      },
  };

  // The proxy implements only the subset of `Database` the app uses
  // (prepare/exec/pull/push/checkpoint/close/transaction). Cast at this single
  // boundary so callers downstream stay typed against the real `Database`.
  return proxy as unknown as Database;
};

export type DbWorkerClient = {
  connect: (params: {
    path: string;
    url?: string;
    authToken?: string;
  }) => Promise<void>;
  deleteLocal: (prefix: string) => Promise<void>;
  dbProxy: Database;
};

let clientPromise: Promise<DbWorkerClient> | null = null;

/**
 * Resolves when this tab knows its role (leader or follower). Rejects if the
 * leader's worker fails (via `becomeLeader`) or — the follower case, where no
 * leader ever comes online and nothing rejects `roleReady` — after a timeout,
 * so `establish` can't hang forever waiting on a dead election.
 */
const awaitRoleReady = () =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Shared DB role election timed out")),
      WORKER_READY_TIMEOUT_MS + 2000
    );
    roleReady.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const establish = async (): Promise<DbWorkerClient> => {
  start();
  await awaitRoleReady();

  return {
    connect: async (params) => {
      await rpc("connect", params);
    },
    deleteLocal: async (prefix) => {
      await rpc("deleteLocal", { prefix });
    },
    dbProxy: createDbProxy(),
  };
};

/** Lazily establishes (once per tab) and returns the shared DB client. */
export const getDbWorkerClient = () => {
  if (!clientPromise) {
    // Clear the memo on failure so a rejected establish isn't cached forever;
    // callers handle the rejection (e.g. fall back to a direct connection).
    clientPromise = establish().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
};

/**
 * Subscribes to cross-tab data-changed notifications broadcast by the worker
 * after local writes and remote pulls. Returns an unsubscribe function.
 */
export const subscribeToDataChanged = (onChanged: () => void) => {
  const channel = new BroadcastChannel(DATA_CHANGED_CHANNEL);
  channel.onmessage = () => onChanged();
  return () => channel.close();
};
