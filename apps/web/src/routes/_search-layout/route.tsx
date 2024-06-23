import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { SearchInput } from "@/components/meili/SearchInput";
import { queryClient } from "@/lib/query";
import { searchClient } from "@/lib/search";
import { trpc, trpcClient } from "@/lib/trpc";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getQueryKey } from "@trpc/react-query";
import { InstantSearch } from "react-instantsearch";

const AppLayout = () => {
  return (
    <InstantSearch
      indexName="dictionary"
      searchClient={searchClient}
      future={{
        // To stop the warning in the logs
        preserveSharedStateOnUnmount: true,
      }}
    >
      {/* Desktop side navigation menu */}
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
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

export const Route = createFileRoute("/_search-layout")({
  component: AppLayout,
  beforeLoad: async ({ location }) => {
    const authData = await queryClient.fetchQuery({
      queryKey: [...getQueryKey(trpc.user.me), { type: "query" }],
      queryFn: () => trpcClient.user.me.query(),
    });

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
