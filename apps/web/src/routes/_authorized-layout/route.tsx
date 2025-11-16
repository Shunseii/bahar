import { DesktopNavigation } from "@/components/DesktopNavigation";
import { MobileHeader } from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useSearch } from "@/hooks/useSearch";
import { initDb } from "@/lib/db";
import { hydrateOramaDb } from "@/lib/search";
import { Trans } from "@lingui/react/macro";
import {
  createFileRoute,
  ErrorRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { FC, useEffect, useState } from "react";
import { isDisplayError } from "@/lib/db/errors";

const AuthorizedLayout = () => {
  const { preloadResults } = useSearch();

  useEffect(() => {
    preloadResults();
  }, [preloadResults]);

  return <Outlet />;
};

const ErrorMessage: FC<{ error: Error }> = ({ error }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { data: session } = authClient.useSession();
  const timestamp = new Date().toLocaleString();

  if (isDisplayError(error)) {
    return (
      <>
        <div className="mt-2 text-muted-foreground text-sm flex flex-col gap-2">
          <p>
            {error.message}{" "}
            <Trans>You can try reloading the page to fix it.</Trans>
          </p>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-left text-primary hover:underline cursor-pointer w-fit"
          >
            {showDetails ? (
              <Trans>Hide details</Trans>
            ) : (
              <Trans>Still not working?</Trans>
            )}
          </button>

          {showDetails && (
            <div>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Please contact{" "}
                  <a
                    className="text-primary hover:underline"
                    href="mailto:support@bahar.dev"
                  >
                    support
                  </a>{" "}
                  with the following details:
                </Trans>
              </p>

              <div className="mt-3 bg-background rounded border border-border space-y-2 p-2">
                <p className="text-xs">
                  <span className="font-semibold">
                    <Trans>User ID:</Trans>
                  </span>{" "}
                  <code>{session?.user?.id ?? "Unknown"}</code>
                </p>

                <p className="text-xs">
                  <span className="font-semibold">
                    <Trans>Time:</Trans>
                  </span>{" "}
                  <code>{timestamp}</code>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="default" onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>

          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/")}
          >
            <Trans>Go Home</Trans>
          </Button>
        </div>
      </>
    );
  } else {
    return (
      <>
        <div className="mt-2 text-muted-foreground text-sm flex flex-col gap-2">
          <p>
            <Trans>An unexpected error occurred.</Trans>{" "}
            <Trans>You can try reloading the page to fix it.</Trans>
          </p>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-left text-primary hover:underline cursor-pointer w-fit"
          >
            {showDetails ? (
              <Trans>Hide details</Trans>
            ) : (
              <Trans>Still not working?</Trans>
            )}
          </button>
          <p></p>

          {showDetails && (
            <div>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Please contact{" "}
                  <a
                    className="text-primary hover:underline"
                    href="mailto:support@bahar.dev"
                  >
                    support
                  </a>{" "}
                  with the following details:
                </Trans>
              </p>

              <div className="mt-3 bg-background rounded border border-border space-y-2 p-2">
                <p className="text-xs">
                  <span className="font-semibold">
                    <Trans>User ID:</Trans>
                  </span>{" "}
                  <code>{session?.user?.id ?? "Unknown"}</code>
                </p>

                <p className="text-xs">
                  <span className="font-semibold">
                    <Trans>Time:</Trans>
                  </span>{" "}
                  <code>{timestamp}</code>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="default" onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>

          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/")}
          >
            <Trans>Go Home</Trans>
          </Button>
        </div>
      </>
    );
  }
};

const AuthorizedLayoutError: ErrorRouteComponent = ({ error }) => {
  return (
    <>
      <DesktopNavigation />

      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <div className="flex flex-col sm:gap-4 sm:py-4 ltr:sm:pl-14 rtl:sm:pr-14">
          <MobileHeader />

          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 flex flex-col items-center justify-center">
              <div className="max-w-md">
                <h2 className="font-semibold text-destructive">
                  <Trans>Uh oh! Something went wrong :/</Trans>
                </h2>

                <ErrorMessage error={error} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export const Route = createFileRoute("/_authorized-layout")({
  beforeLoad: async () => {
    await initDb();
    await hydrateOramaDb();
  },
  errorComponent: (props) => <AuthorizedLayoutError {...props} />,
  component: AuthorizedLayout,
});
