import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

const AppLayout = () => {
  return (
    <>
      {/* Desktop side navigation menu */}
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          {/* Mobile nav and search bar */}
          <MobileHeader />

          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute("/_app-layout")({
  component: AppLayout,
  beforeLoad: async ({ location, context }) => {
    const authData = context.authState;

    const isAuthenticated = !!authData;

    if (!isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
});
