import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { SearchInput } from "@/components/search/SearchInput";
import { SORT_OPTIONS } from "@/hooks/search/useSearch";
import { authClient } from "@/lib/auth-client";
import { settingsTable } from "@/lib/db/operations/settings";
import { queryClient } from "@/lib/query";

const filtersSchema = z.object({
  tags: z.array(z.string()).optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
});

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
          <MobileHeader>
            <SearchInput className="m-auto" />
          </MobileHeader>

          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute("/_authorized-layout/_search-layout")({
  component: AppLayout,
  validateSearch: zodValidator(filtersSchema),
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();

    const isAuthenticated = !!data?.user;

    if (isAuthenticated) {
      await queryClient.ensureQueryData({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
        queryFn: settingsTable.getSettings.query,
      });
    } else {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
});
