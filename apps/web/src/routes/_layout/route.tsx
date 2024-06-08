import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import { Outlet, createFileRoute } from "@tanstack/react-router";

const Layout = () => {
  return (
    <div className="h-screen p-8">
      <div className="flex justify-between">
        <ThemeMenu />
        <LanguageMenu />
      </div>

      <div className="flex flex-col justify-center items-center gap-y-6 mx-auto max-w-96">
        <Outlet />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_layout")({
  component: Layout,
});
