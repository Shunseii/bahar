import { Button } from "@bahar/web-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bahar/web-ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Home, Layers, Settings } from "lucide-react";
import { motion } from "motion/react";
import Logo from "@/assets/logo.svg";
import { NavLink } from "@/components/NavLink";
import { useLogout } from "@/hooks/useLogout";

export const DesktopNavigation = () => {
  const { logout } = useLogout();

  return (
    <aside className="fixed inset-y-0 z-10 hidden w-14 flex-col border-sidebar-border bg-sidebar sm:flex ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l">
      {/* Main nav buttons */}
      <nav className="flex flex-col items-center gap-4 px-2 py-4">
        <Link
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 font-semibold text-lg md:h-8 md:w-8 md:text-base"
          to="/"
        >
          <motion.img
            alt=""
            className="h-5 w-5"
            src={Logo}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          />
          <span className="sr-only">
            <Trans>Bahar</Trans>
          </span>
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink params={{}} to="/">
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
            <NavLink params={{}} to="/decks">
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
              className="overflow-hidden rounded-full transition-colors duration-200 hover:bg-muted/80"
              size="icon"
              variant="ghost"
            >
              <Settings className="h-5 w-5 text-muted-foreground transition-colors duration-200 hover:text-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48" sideOffset={8}>
            <DropdownMenuLabel className="font-medium text-muted-foreground text-xs rtl:text-right">
              <Trans>My Account</Trans>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link
                className="flex w-full cursor-pointer items-center gap-2 rtl:flex-row-reverse"
                from="/"
                to="/settings"
              >
                <Settings className="h-4 w-4" />
                <Trans>Settings</Trans>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Button
                className="w-full cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive ltr:justify-start rtl:justify-end"
                onClick={logout}
                variant="ghost"
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
