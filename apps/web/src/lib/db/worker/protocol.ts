/**
 * RPC protocol between the main thread and the dedicated DB worker.
 *
 * A tab talks to the worker over a `MessagePort` brokered by the SharedWorker
 * (see db.shared-worker.ts): every request carries an `id` the worker echoes
 * back on the same port. Data-changed notifications travel out-of-band over a
 * BroadcastChannel (DATA_CHANGED_CHANNEL), not this request/response path.
 */

/** BroadcastChannel name the worker uses to notify tabs that data changed. */
export const DATA_CHANGED_CHANNEL = "bahar-db-changed";

/** Response id the worker posts on a client port once it's ready for requests. */
export const READY_ID = -1;

export type ConnectParams = {
  path: string;
  url?: string;
  authToken?: string;
};

export type QueryParams = {
  sql: string;
  params: unknown[];
  method: "run" | "all" | "get";
};

export type DbWorkerRequest =
  | { id: number; method: "connect"; params: ConnectParams }
  | { id: number; method: "query"; params: QueryParams }
  | { id: number; method: "exec"; params: { sql: string } }
  | { id: number; method: "pull"; params: undefined }
  | { id: number; method: "push"; params: undefined }
  | { id: number; method: "close"; params: undefined }
  | { id: number; method: "deleteLocal"; params: { prefix: string } };

export type DbWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

/** Message the leader tab sends its dedicated worker to register a client port. */
export type NewClientMessage = { type: "client" };

/**
 * Cross-tab relay protocol (BroadcastChannel RELAY_CHANNEL).
 *
 * OPFS SyncAccessHandles live in one dedicated worker, and a SharedWorker can't
 * spawn a worker — so one tab is elected leader (via a Web Lock), spawns the
 * DB worker, and answers RPC for every other (follower) tab over this channel.
 */
export const RELAY_CHANNEL = "bahar-db-rpc";

export type RelayMessage =
  | {
      kind: "request";
      requestId: string;
      from: string;
      method: DbWorkerRequest["method"];
      params: unknown;
    }
  | ({ kind: "response"; requestId: string; to: string } & (
      | { ok: true; result: unknown }
      | { ok: false; error: string }
    ))
  // Leader announces it's serving; also sent in reply to `whos-leader`.
  | { kind: "leader-online" }
  // A starting follower asks whether a leader already exists.
  | { kind: "whos-leader" };
