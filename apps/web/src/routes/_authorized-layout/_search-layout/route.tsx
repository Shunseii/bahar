import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { SearchInput } from "@/components/meili/SearchInput";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query";
import { searchClient } from "@/lib/search";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { InstantSearch } from "react-instantsearch";
import * as Sentry from "@sentry/react";
import { settingsTable } from "@/lib/db/operations";

const AppLayout = () => {
  const { data } = authClient.useSession();
  const userIndexId = data?.user?.id ?? "";

  if (!userIndexId) return null;

  Sentry.setUser({ id: data?.user.id, email: data?.user.email });

  return (
    <InstantSearch
      indexName={userIndexId}
      searchClient={searchClient}
      future={{
        // To stop the warning in the logs
        preserveSharedStateOnUnmount: true,
      }}
    >
      {/* Desktop side navigation menu */}
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
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
    </InstantSearch>
  );
};

export const Route = createFileRoute("/_authorized-layout/_search-layout")({
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
    } else {
      await queryClient.ensureQueryData({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
        queryFn: settingsTable.getSettings.query,
      });
    }
  },
});
