import { initDb } from "@/lib/db";
import { hydrateOramaDb } from "@/lib/search";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authorized-layout")({
  beforeLoad: async () => {
    await initDb();
    await hydrateOramaDb();
  },
});
