/**
 * sync-wasm's metadata IO (`BrowserIO`) reads/writes Turso sync generation
 * state through `localStorage`, which does not exist in any worker scope and
 * isn't injectable (`connect` hardcodes it). We install a `localStorage`-shaped
 * object on the worker global backed by IndexedDB.
 *
 * `localStorage`'s API is synchronous, so the shim serves reads/writes from an
 * in-memory map and persists asynchronously (write-through) to IndexedDB. The
 * map is preloaded from IndexedDB before the DB connects, so sync metadata
 * survives worker restarts (a fresh worker would otherwise re-bootstrap the
 * whole remote DB every time the last tab closed and reopened).
 */

const DB_NAME = "bahar-sync-metadata";
const STORE_NAME = "kv";

const openIdb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const promisifyRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Loads every persisted key/value into memory. Called once before connect.
 */
const loadAll = async (idb: IDBDatabase) => {
  const transaction = idb.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const keys = (await promisifyRequest(store.getAllKeys())) as string[];
  const values = (await promisifyRequest(store.getAll())) as string[];

  const entries = new Map<string, string>();
  keys.forEach((key, index) => entries.set(key, values[index]));
  return entries;
};

/**
 * Installs the IndexedDB-backed `localStorage` shim on the worker global if one
 * isn't already present. Awaits the initial load so the first synchronous
 * `getItem` after this resolves already sees persisted metadata.
 */
export const installLocalStorageShim = async () => {
  if ("localStorage" in globalThis) return;

  const idb = await openIdb();
  const memory = await loadAll(idb);

  const persist = (key: string, value: string | null) => {
    const transaction = idb.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    if (value === null) store.delete(key);
    else store.put(value, key);
  };

  const shim: Pick<
    Storage,
    "getItem" | "setItem" | "removeItem" | "clear" | "key" | "length"
  > = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      const stringified = String(value);
      memory.set(key, stringified);
      persist(key, stringified);
    },
    removeItem: (key) => {
      memory.delete(key);
      persist(key, null);
    },
    clear: () => {
      memory.clear();
      const transaction = idb.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
    },
    key: (index) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: shim,
    configurable: true,
  });
};

/** Clears all persisted sync metadata. Used by the deleteLocal flow. */
export const clearSyncMetadata = async () => {
  const idb = await openIdb();
  const transaction = idb.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).clear();
  globalThis.localStorage?.clear();
};
