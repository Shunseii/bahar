import React from "react";
import { Trans } from "@lingui/macro";
import { cn } from "@/lib/utils";

interface BetaBadgeProps {
  className?: string;
}

export const BetaBadge: React.FC<BetaBadgeProps> = ({ className = "" }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full",
        className,
      )}
    >
      <Trans>BETA</Trans>
    </span>
  );
};
