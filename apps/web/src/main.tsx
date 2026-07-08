import { registerSW } from "virtual:pwa-register";
import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./globals.css";

registerSW({ immediate: true });

// The sync-wasm OPFS worker rejects with "Cannot read properties of undefined
// (reading 'read')" (at readFileAtWorker/read_async) when its SyncAccessHandle
// is released while a read is in flight. It surfaces as an uncaught promise
// rejection rather than through a caught query path, so capture it explicitly
// as a distinct, trace-correlated event instead of letting it be console noise.
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);

  const isOpfsWorkerRead =
    message.includes("reading 'read'") || message.includes("readFileAtWorker");

  if (isOpfsWorkerRead) {
    Sentry.captureException(reason, {
      fingerprint: ["opfs-worker-read-rejection"],
      tags: { source: "opfs_worker" },
    });
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
