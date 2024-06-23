import { LanguageMenu } from "@/components/LanguageMenu";
import { Page } from "@/components/Page";
import { ThemeMenu } from "@/components/ThemeMenu";
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

export const Route = createFileRoute("/_layout")({
  component: Layout,
});
