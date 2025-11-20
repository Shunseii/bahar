import { Trans } from "@lingui/react/macro";
import { forwardRef, useState } from "react";
import React from "react";
import { cn } from "@bahar/design-system";

const SCHEMA_OUTDATED_BANNER_DISMISSED_KEY = "schema-outdated-dismissed";

export const SchemaOutdatedBanner = forwardRef<HTMLDivElement>((_, ref) => {
  const [isDismissed, setIsDismissed] = useState(() => {
    return (
      sessionStorage.getItem(SCHEMA_OUTDATED_BANNER_DISMISSED_KEY) === "true"
    );
  });

  const handleDismiss = () => {
    sessionStorage.setItem(SCHEMA_OUTDATED_BANNER_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "fixed top-0 inset-x-0 z-30 sm:z-40 bg-background border-b border-border px-4 py-3 sm:ltr:ml-14 sm:rtl:mr-14",
        isDismissed && "hidden",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-foreground">
          We're updating your account's database structure. Some features may be
          limited.{" "}
          <a
            href="mailto:support@bahar.dev"
            className="underline hover:no-underline font-medium"
          >
            <Trans>Contact support</Trans>
          </a>{" "}
          <Trans>if needed.</Trans>
        </p>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 px-2 py-1 bg-muted hover:bg-muted/80 text-foreground font-medium text-sm rounded border border-border"
        >
          <Trans>Dismiss</Trans>
        </button>
      </div>
    </div>
  );
});
