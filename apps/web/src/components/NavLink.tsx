import { cn } from "@/lib/utils";
import { Link, LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";

type NavLinkProps = Omit<LinkProps, "activeProps" | "inactiveProps">;

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, to, children, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        to={to}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8",
          className,
        )}
        activeProps={{ className: "hover:text-foreground" }}
        inactiveProps={{
          className: "hover:text-foreground text-muted-foreground",
        }}
        {...props}
      >
        {children}
      </Link>
    );
  },
);
