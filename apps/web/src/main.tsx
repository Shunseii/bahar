import { registerSW } from "virtual:pwa-register";
import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./globals.css";

// `autoUpdate` applies a new service worker and reloads the page as soon as one
// takes control, but it only checks for an update at registration (page load).
// Installed PWAs stay warm for days and never re-register, so a client can keep
// running a stale bundle indefinitely — which stranded users on an old sync-wasm
// engine that could no longer decode the remote's sync frames. Poll for a new
// service worker on an interval so long-lived sessions pick up fixes without a
// manual reinstall.
const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW(_swScriptUrl, registration) {
    if (!registration) return;

    setInterval(() => {
      registration.update();
    }, SW_UPDATE_CHECK_INTERVAL_MS);
  },
});

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
