import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trans } from "@lingui/macro";
import { Link } from "@tanstack/react-router";
import { Home, Settings, Layers } from "lucide-react";
import { useLogout } from "@/hooks/useLogout";

import Logo from "@/assets/logo.svg";

export const DesktopNavigation = () => {
  const { logout } = useLogout();

  return (
    <aside className="fixed inset-y-0 ltr:left-0 rtl:right-0 z-10 hidden w-14 flex-col ltr:border-r rtl:border-l bg-background sm:flex">
      {/* Main nav buttons */}
      <nav className="flex flex-col items-center gap-4 px-2 py-4">
        <Link
          to="/"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 text-lg font-semibold md:h-8 md:w-8 md:text-base"
        >
          <img
            src={Logo}
            className="h-5 w-5 transition-all group-hover:scale-110"
          />
          <span className="sr-only">
            <Trans>Bahar</Trans>
          </span>
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink to="/" params={{}}>
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

        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink to="/decks" params={{}}>
              <Layers className="h-5 w-5" />

              <span className="sr-only">
                <Trans>Decks</Trans>
              </span>
            </NavLink>
          </TooltipTrigger>

          <TooltipContent side="right">
            <Trans>Decks</Trans>
          </TooltipContent>
        </Tooltip>
      </nav>

      {/* Settings Button */}
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
                onClick={logout}
              >
                <Trans>Logout</Trans>
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </aside>
  );
};
