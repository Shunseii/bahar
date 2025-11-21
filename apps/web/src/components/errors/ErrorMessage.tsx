import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Trans } from "@lingui/react/macro";
import { FC, ReactNode, useMemo, useState } from "react";
import { DisplayError } from "@/lib/db/errors";
import { Copy } from "lucide-react";

const ContactSupportSection = () => (
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
      <div className="mt-2 text-muted-foreground text-sm flex flex-col gap-2">
        {isDisplayError ? (
          <p>{error.message}</p>
        ) : (
          <Trans>
            An unexpected error occurred. You can try reloading the page to fix
            it.
          </Trans>
        )}

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-left text-primary hover:underline cursor-pointer w-fit"
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

            <div className="mt-3 bg-background rounded border border-border space-y-2 p-2">
              <div className="flex items-center justify-between float-end">
                <button
                  onClick={handleCopyDetails}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rtl:flex-row-reverse flex-row"
                  title={copied ? "Copied!" : "Copy error details"}
                >
                  <Copy size={14} />
                  {copied ? <Trans>Copied!</Trans> : <Trans>Copy</Trans>}
                </button>
              </div>

              <ErrorDetailField
                fieldName={<Trans>ID:</Trans>}
                detail={session?.user?.id ?? "Unknown"}
              />

              <ErrorDetailField
                fieldName={<Trans>Time:</Trans>}
                detail={timestamp}
              />

              {isDisplayError && (
                <>
                  <ErrorDetailField
                    fieldName={<Trans>Cause:</Trans>}
                    detail={error.cause}
                  />

                  <ErrorDetailField
                    fieldName={<Trans>Details:</Trans>}
                    detail={error.details}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {hasManualFix && (
        <div className="mt-4 flex gap-2">
          <Button variant="default" onClick={() => window.location.reload()}>
            <Trans>Reload</Trans>
          </Button>
        </div>
      )}
    </>
  );
};
