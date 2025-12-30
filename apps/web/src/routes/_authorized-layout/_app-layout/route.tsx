import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { authClient } from "@/lib/auth-client";

const AppLayout = () => {
  const { data } = authClient.useSession();

  if (!data?.user) return null;

  return (
    <>
      {/* Desktop side navigation menu */}
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-background">
        <div className="flex flex-col sm:gap-4 sm:py-4 ltr:sm:pl-14 rtl:sm:pr-14">
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

export const Route = createFileRoute("/_authorized-layout/_app-layout")({
  component: AppLayout,
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();

    const isAuthenticated = !!data?.user;

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
