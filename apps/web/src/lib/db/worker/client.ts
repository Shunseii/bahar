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

// ---- Dedicated worker (leader only) --------------------------------------

const waitForReady = (port: MessagePort) =>
  new Promise<void>((resolve) => {
    const onReady = (event: MessageEvent<DbWorkerResponse>) => {
      if (event.data.id !== READY_ID) return;
      port.removeEventListener("message", onReady);
      resolve();
    };
    port.addEventListener("message", onReady);
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
  const ready = waitForReady(port);

  const newClient: NewClientMessage = { type: "client" };
  worker.postMessage(newClient, [channel.port1]);
  await ready;

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
const roleReady = new Promise<void>((resolve) => {
  resolveRoleReady = resolve;
});

const post = (message: RelayMessage) => relay?.postMessage(message);

/** Runs a follower's queued requests against whichever worker now serves. */
const flushPending = (send: (request: PendingRequest, id: string) => void) => {
  for (const [id, request] of pending) send(request, id);
};

const becomeLeader = async () => {
  workerRpc = await spawnWorkerRpc();
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
  navigator.locks.request(LEADER_LOCK, { mode: "exclusive" }, async () => {
    await becomeLeader();
    // Hold the lock for this tab's whole lifetime; it releases on tab unload,
    // letting another tab win the election and take over as leader.
    await new Promise<never>(() => {
      // never resolves
    });
  });
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
    close: () => rpc("close", undefined),
  };

  // The proxy implements only the subset of `Database` the app uses
  // (prepare/exec/pull/push/close). Cast at this single boundary so callers
  // downstream stay typed against the real `Database`.
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

const establish = async (): Promise<DbWorkerClient> => {
  start();
  await roleReady;

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
  if (!clientPromise) clientPromise = establish();
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
