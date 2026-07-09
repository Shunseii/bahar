/// <reference lib="webworker" />

/**
 * Captures client-port messages that arrive while the worker is still
 * initializing. This module MUST be imported before the heavy
 * `@tursodatabase/sync-wasm/bundle` import: ES modules evaluate imports in
 * order before the importer's body, so registering the listener here runs
 * before that import's top-level `await` (WASM instantiate). A listener
 * registered only after those awaits misses messages the SharedWorker posts
 * during init — they are dropped, not redelivered.
 *
 * Ports arriving before a handler is set are buffered and drained the moment
 * `onClientPort` registers one.
 */

const pendingPorts: MessagePort[] = [];
let handler: ((port: MessagePort) => void) | null = null;

self.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type !== "client") return;
  const port = event.ports[0];
  if (handler) handler(port);
  else pendingPorts.push(port);
});

/** Registers the client-port handler and flushes any ports buffered so far. */
export const onClientPort = (fn: (port: MessagePort) => void) => {
  handler = fn;
  for (const port of pendingPorts) fn(port);
  pendingPorts.length = 0;
};
