import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDir } from "@/hooks/useDir";
import { trpc } from "@/lib/trpc";
import { Trans } from "@lingui/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Book, Home, PanelLeft, Settings } from "lucide-react";
import { FC, PropsWithChildren } from "react";

export const MobileHeader: FC<PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const dir = useDir();

  const { mutate: logout } = trpc.auth.logout.useMutation();

  return (
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
              <NavLink to="/" className="h-auto w-auto justify-start gap-x-2">
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

      {children}
    </header>
  );
};
