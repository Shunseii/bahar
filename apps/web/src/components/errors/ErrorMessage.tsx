import { Button } from "@bahar/web-ui/components/button";
import { Trans } from "@lingui/react/macro";
import { Copy } from "lucide-react";
import { type FC, type ReactNode, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { DisplayError } from "@/lib/db/errors";

const ContactSupportSection = () => (
  <p className="text-muted-foreground text-sm">
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
);

const ErrorDetailField: FC<{ fieldName: ReactNode; detail: ReactNode }> = ({
  fieldName,
  detail,
}) => {
  return (
    <p className="text-xs">
      <span className="font-semibold">{fieldName}</span> <span>{detail}</span>
    </p>
  );
};

export const ErrorMessage: FC<{ error: Error }> = ({ error }) => {
  const isDisplayError = error instanceof DisplayError;

  /**
   * Whether the user can do some actual to attempt
   * to fix the error, such as reloading the page.
   */
  const hasManualFix =
    !isDisplayError || (isDisplayError && error.hasManualFix);

  const [showDetails, setShowDetails] = useState(!hasManualFix);
  const [copied, setCopied] = useState(false);
  const { data: session } = authClient.useSession();

  const timestamp = useMemo(() => {
    return new Date().toLocaleString(undefined, { timeZoneName: "short" });
  }, []);

  const handleCopyDetails = () => {
    const details = {
      userId: session?.user?.id ?? "Unknown",
      time: timestamp,
      ...(isDisplayError && {
        cause: error.cause,
        details: error.details,
      }),
    };
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2 * 1000);
  };

  return (
    <>
      <div className="mt-2 flex flex-col gap-2 text-muted-foreground text-sm">
        {isDisplayError ? (
          <p>{error.message}</p>
        ) : (
          <Trans>
            An unexpected error occurred. You can try reloading the page to fix
            it.
          </Trans>
        )}

        <button
          className="w-fit cursor-pointer text-left text-primary hover:underline"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? (
            <Trans>Hide details</Trans>
          ) : hasManualFix ? (
            <Trans>Still not working?</Trans>
          ) : (
            <Trans>Show details</Trans>
          )}
        </button>

        {showDetails && (
          <div>
            <ContactSupportSection />

            <div className="mt-3 space-y-2 rounded border border-border bg-background p-2">
              <div className="float-end flex items-center justify-between">
                <button
                  className="flex flex-row items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground rtl:flex-row-reverse"
                  onClick={handleCopyDetails}
                  title={copied ? "Copied!" : "Copy error details"}
                >
                  <Copy size={14} />
                  {copied ? <Trans>Copied!</Trans> : <Trans>Copy</Trans>}
                </button>
              </div>

              <ErrorDetailField
                detail={session?.user?.id ?? "Unknown"}
                fieldName={<Trans>ID:</Trans>}
              />

              <ErrorDetailField
                detail={timestamp}
                fieldName={<Trans>Time:</Trans>}
              />

              {isDisplayError && error.cause && (
                <>
                  <ErrorDetailField
                    detail={error.cause}
                    fieldName={<Trans>Cause:</Trans>}
                  />
                </>
              )}

              <ErrorDetailField
                detail={
                  isDisplayError
                    ? error.details
                    : `${error.name}: ${error.message}`
                }
                fieldName={<Trans>Details:</Trans>}
              />
            </div>
          </div>
        )}
      </div>

      {hasManualFix && (
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()} variant="default">
            <Trans>Reload</Trans>
          </Button>
        </div>
      )}
    </>
  );
};
