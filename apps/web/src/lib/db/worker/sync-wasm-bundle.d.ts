// The `@tursodatabase/sync-wasm/bundle` entry ships no type declarations (its
// export map has only a runtime `default`). It exposes the same `connect` /
// `Database` API as the typed entries, so re-declare it from one of those.
declare module "@tursodatabase/sync-wasm/bundle" {
  export { connect, Database } from "@tursodatabase/sync-wasm/vite";
}
