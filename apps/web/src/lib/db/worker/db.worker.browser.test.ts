import { afterEach, beforeEach, expect, it } from "vitest";
import {
  type DbWorkerRequest,
  type DbWorkerResponse,
  READY_ID,
} from "./protocol";

/**
 * Component test for the dedicated DB worker. Drives it the same way the
 * SharedWorker does in production: hand it one end of a MessageChannel as a
 * client port and speak the RPC protocol over the other. Runs in a real browser
 * (vitest + playwright, COOP/COEP + OPFS) — the only place sync-wasm can run.
 *
 * Covers: WASM boots inside a dedicated worker, and connect + exec + query
 * round-trip over the port, returning raw name-keyed rows (the shape
 * buildDrizzleDb and the raw callers both rely on). The SharedWorker relay,
 * main-thread proxy, and true multi-tab sharing are covered by the Playwright
 * e2e (e2e/multi-tab.spec.ts).
 */

let worker: Worker;
let port: MessagePort;
let nextId = 0;

const rpc = (method: DbWorkerRequest["method"], params: unknown) =>
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

beforeEach(async () => {
  worker = new Worker(new URL("./db.worker.ts", import.meta.url), {
    type: "module",
  });

  const channel = new MessageChannel();
  port = channel.port2;

  // Wait for the worker's per-port ready signal before sending requests — it
  // does heavy top-level WASM init and the first message would otherwise race
  // handler registration.
  const ready = new Promise<void>((resolve) => {
    const onReady = (event: MessageEvent<DbWorkerResponse>) => {
      if (event.data.id !== READY_ID) return;
      port.removeEventListener("message", onReady);
      resolve();
    };
    port.addEventListener("message", onReady);
    port.start();
  });

  worker.postMessage({ type: "client" }, [channel.port1]);
  await ready;
});

afterEach(async () => {
  await rpc("close", undefined).catch(() => {
    // best effort; the worker is terminated next regardless
  });
  worker.terminate();
});

it("connects and round-trips SQLite over the client port", async () => {
  await rpc("connect", { path: ":memory:" });

  await rpc("exec", { sql: "CREATE TABLE spike (id INTEGER, name TEXT)" });
  await rpc("query", {
    sql: "INSERT INTO spike (id, name) VALUES (?, ?)",
    params: [1, "hello"],
    method: "run",
  });

  // query returns raw name-keyed rows (not positionalized), matching the real
  // driver — buildDrizzleDb does its own Object.values on top.
  const row = await rpc("query", {
    sql: "SELECT id, name FROM spike WHERE id = ?",
    params: [1],
    method: "get",
  });

  expect(row).toEqual({ id: 1, name: "hello" });
});
