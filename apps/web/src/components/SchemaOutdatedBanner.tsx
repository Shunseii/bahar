import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import { forwardRef, useState } from "react";

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
      className={cn(
        "fixed inset-x-0 top-0 z-30 border-border border-b bg-background px-4 py-3 sm:z-40 sm:ltr:ml-14 sm:rtl:mr-14",
        isDismissed && "hidden"
      )}
      ref={ref}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-foreground text-sm">
          We're updating your account's database structure. Some features may be
          limited.{" "}
          <a
            className="font-medium underline hover:no-underline"
            href="mailto:support@bahar.dev"
          >
            <Trans>Contact support</Trans>
          </a>{" "}
          <Trans>if needed.</Trans>
        </p>
        <button
          className="flex-shrink-0 rounded border border-border bg-muted px-2 py-1 font-medium text-foreground text-sm hover:bg-muted/80"
          onClick={handleDismiss}
        >
          <Trans>Dismiss</Trans>
        </button>
      </div>
    </div>
  );
});
