import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import { resetDb } from "@/lib/db";
import { resetOramaDb } from "@/lib/search";
import { Outlet, createFileRoute } from "@tanstack/react-router";

const Layout = () => {
  return (
    <div className="h-screen p-8">
      <div className="flex justify-between">
        <ThemeMenu />
        <LanguageMenu />
      </div>

      <Outlet />
    </div>
  );
};

export const Route = createFileRoute("/_unauthorized-layout")({
  component: Layout,
  beforeLoad: async () => {
    resetOramaDb();
    await resetDb();
  },
});
