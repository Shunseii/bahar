import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import type React from "react";

interface BetaBadgeProps {
  className?: string;
}

export const BetaBadge: React.FC<BetaBadgeProps> = ({ className = "" }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary px-2 py-1 font-bold text-primary-foreground text-xs leading-none",
        className
      )}
    >
      <Trans>BETA</Trans>
    </span>
  );
};
