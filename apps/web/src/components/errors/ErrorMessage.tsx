import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Trans } from "@lingui/react/macro";
import { FC, ReactNode, useState } from "react";
import { DisplayError } from "@/lib/db/errors";

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
      <span className="font-semibold">
        <Trans>{fieldName}</Trans>
      </span>{" "}
      <span>{detail}</span>
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
  const { data: session } = authClient.useSession();
  const timestamp = new Date().toLocaleString();

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
              <ErrorDetailField
                fieldName={<Trans>User ID:</Trans>}
                detail={session?.user?.id ?? "Unknown"}
              />

              <ErrorDetailField
                fieldName={<Trans>Time:</Trans>}
                detail={timestamp}
              />

              {isDisplayError && (
                <>
                  <ErrorDetailField
                    fieldName={<Trans>Details:</Trans>}
                    detail={error.details}
                  />

                  <ErrorDetailField
                    fieldName={<Trans>Cause:</Trans>}
                    detail={error.cause}
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
