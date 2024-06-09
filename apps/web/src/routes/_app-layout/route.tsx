import { NavLink } from "@/components/NavLink";
import { SearchInput } from "@/components/meili/SearchInput";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDir } from "@/hooks/useDir";
import { trpc } from "@/lib/trpc";
import { Trans } from "@lingui/macro";
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";
import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useMatchRoute,
} from "@tanstack/react-router";
import { Book, Home, PanelLeft, Settings } from "lucide-react";
import { InstantSearch } from "react-instantsearch";

const { searchClient } = instantMeiliSearch(
  import.meta.env.VITE_MEILISEARCH_API_URL,
  import.meta.env.VITE_MEILISEARCH_API_KEY,
);

const AppLayout = () => {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const dir = useDir();

  const { mutate: logout } = trpc.auth.logout.useMutation();

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
      <aside className="fixed inset-y-0 ltr:left-0 rtl:right-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 py-4">
          <Link
            to="/"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Book className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">
              <Trans>Bahar</Trans>
            </span>
          </Link>

          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink to="/">
                <Home className="h-5 w-5" />

                <span className="sr-only">
                  <Trans>Home</Trans>
                </span>
              </NavLink>
            </TooltipTrigger>

            <TooltipContent side="right">
              <Trans>Home</Trans>
            </TooltipContent>
          </Tooltip>
        </nav>

        <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="!ring-0 !outline-none overflow-hidden rounded-full"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <Trans>My Account</Trans>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link className="cursor-pointer w-full" to="/settings" from="/">
                  <Trans>Settings</Trans>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Button
                  variant="ghost"
                  className="cursor-pointer justify-start w-full !ring-0 !outline-none"
                  onClick={async () => {
                    logout();

                    await queryClient.invalidateQueries();

                    navigate({
                      to: "/login",
                      replace: true,
                      resetScroll: true,
                    });
                  }}
                >
                  <Trans>Logout</Trans>
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </aside>

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="icon" variant="outline" className="sm:hidden">
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">
                    <Trans>Toggle Menu</Trans>
                  </span>
                </Button>
              </SheetTrigger>

              <SheetContent
                side={dir === "rtl" ? "right" : "left"}
                className="sm:max-w-xs"
              >
                <nav className="flex flex-col gap-y-6 text-lg font-medium">
                  <Link
                    href="/"
                    className="group flex h-10 w-10 shrink-0 items-center justify-center gap-y-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
                  >
                    <Book className="h-5 w-5 transition-all group-hover:scale-110" />
                    <span className="sr-only">
                      <Trans>Bahar</Trans>
                    </span>
                  </Link>

                  <div className="flex flex-col gap-y-2">
                    <NavLink
                      to="/"
                      className="h-auto w-auto justify-start gap-x-2"
                    >
                      <Home className="w-5 h-5" />
                      <Trans>Home</Trans>
                    </NavLink>

                    <NavLink
                      to="/settings"
                      className="h-auto w-auto justify-start gap-x-2"
                    >
                      <Settings className="w-5 h-5" />
                      <Trans>Settings</Trans>
                    </NavLink>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={async () => {
                      logout();

                      await queryClient.invalidateQueries();

                      navigate({
                        to: "/login",
                        replace: true,
                        resetScroll: true,
                      });
                    }}
                    asChild
                  >
                    <p>
                      <Trans>Logout</Trans>
                    </p>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            {shouldDisplaySearchInput ? (
              <SearchInput className="m-auto" />
            ) : undefined}
          </header>

          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <Outlet />
          </main>
        </div>
      </div>
    </InstantSearch>
  );
};

export const Route = createFileRoute("/_app-layout")({
  component: AppLayout,
});
