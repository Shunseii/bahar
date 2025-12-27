import { cn } from "@bahar/design-system";
import { Link, type LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";

type NavLinkProps = Omit<LinkProps, "activeProps" | "inactiveProps"> & {
  className?: string;
  onClick?: () => void;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, to, children, ...props }, ref) => {
    return (
      <Link
        activeProps={{ className: "hover:text-foreground" }}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8",
          className
        )}
        inactiveProps={{
          className: "hover:text-foreground text-muted-foreground",
        }}
        ref={ref}
        to={to}
        {...props}
      >
        {children}
      </Link>
    );
  }
);
