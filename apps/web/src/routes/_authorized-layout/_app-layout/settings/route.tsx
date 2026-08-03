import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Nothing of its own to render -- it exists so /settings can have children
 * (card appearance), with the settings page itself living in index.lazy.tsx.
 * Without this the child route has no outlet to render into.
 */
export const Route = createFileRoute(
  "/_authorized-layout/_app-layout/settings"
)({
  component: Outlet,
});
