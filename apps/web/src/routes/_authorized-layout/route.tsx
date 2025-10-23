import { useSearch } from "@/hooks/useSearch";
import { initDb } from "@/lib/db";
import { hydrateOramaDb } from "@/lib/search";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

const AuthorizedLayout = () => {
  const { preloadResults } = useSearch();

  useEffect(() => {
    preloadResults();
  }, [preloadResults]);

  return <Outlet />;
};

export const Route = createFileRoute("/_authorized-layout")({
  beforeLoad: async () => {
    await initDb();
    await hydrateOramaDb();
  },
  component: AuthorizedLayout,
});
