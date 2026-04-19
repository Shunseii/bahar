import { Button } from "@bahar/web-ui/components/button";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";

const Goodbye = () => {
  return (
    <div className="mx-auto mt-32 flex max-w-md flex-col items-center gap-y-6 text-center">
      <h1 className="font-primary font-semibold text-3xl">
        <Trans>Your account has been deleted</Trans>
      </h1>

      <p className="text-muted-foreground">
        <Trans>
          We're sorry to see you go. All your data has been permanently removed.
        </Trans>
      </p>

      <Button asChild variant="outline">
        <Link to="/login">
          <Trans>Back to sign in</Trans>
        </Link>
      </Button>
    </div>
  );
};

export const Route = createFileRoute("/_unauthorized-layout/goodbye")({
  component: Goodbye,
});
