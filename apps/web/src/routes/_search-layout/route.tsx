import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { SearchInput } from "@/components/meili/SearchInput";
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";
import {
  Outlet,
  createFileRoute,
  useMatchRoute,
  redirect,
} from "@tanstack/react-router";
import { InstantSearch } from "react-instantsearch";

const { searchClient } = instantMeiliSearch(
  import.meta.env.VITE_MEILISEARCH_API_URL,
  import.meta.env.VITE_MEILISEARCH_API_KEY,
);

const AppLayout = () => {
  const matchRoute = useMatchRoute();

  const shouldDisplaySearchInput = matchRoute({
    to: "/",
    from: "/",
    fuzzy: false,
  });

  return (
    <InstantSearch
      indexName="dictionary"
      searchClient={searchClient}
      future={{
        preserveSharedStateOnUnmount: true,
      }}
    >
      {/* Desktop side navigation menu */}
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          {/* Mobile nav and search bar */}
          <MobileHeader>
            {shouldDisplaySearchInput ? (
              <SearchInput className="m-auto" />
            ) : undefined}
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
