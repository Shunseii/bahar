import { Trans } from "@lingui/react/macro";
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
import { Link } from "@tanstack/react-router";
import { Home, Settings, Layers } from "lucide-react";
import { useLogout } from "@/hooks/useLogout";
import { motion } from "motion/react";

import Logo from "@/assets/logo.svg";

export const DesktopNavigation = () => {
  const { logout } = useLogout();

  return (
    <aside className="fixed inset-y-0 ltr:left-0 rtl:right-0 z-10 hidden w-14 flex-col ltr:border-r rtl:border-l bg-gradient-to-b from-background to-background/95 backdrop-blur-sm sm:flex">
      {/* Main nav buttons */}
      <nav className="flex flex-col items-center gap-4 px-2 py-4">
        <Link
          to="/"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 text-lg font-semibold md:h-8 md:w-8 md:text-base"
        >
          <motion.img
            src={Logo}
            alt=""
            className="h-5 w-5"
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
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

          <TooltipContent side="right" sideOffset={8}>
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

          <TooltipContent side="right" sideOffset={8}>
            <Trans>Decks</Trans>
          </TooltipContent>
        </Tooltip>
      </nav>

      {/* Settings Button */}
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="overflow-hidden rounded-full hover:bg-muted/80 transition-colors duration-200"
            >
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors duration-200" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-48">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground rtl:text-right">
              <Trans>My Account</Trans>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link
                className="cursor-pointer w-full flex items-center gap-2 rtl:flex-row-reverse"
                to="/settings"
                from="/"
              >
                <Settings className="w-4 h-4" />
                <Trans>Settings</Trans>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Button
                variant="ghost"
                className="cursor-pointer ltr:justify-start rtl:justify-end w-full text-destructive hover:text-destructive hover:bg-destructive/10"
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
