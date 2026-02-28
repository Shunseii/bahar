import { Button } from "@bahar/web-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import { Trans } from "@lingui/react/macro";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { Page } from "@/components/Page";

const CheckoutSuccess = () => {
  return (
    <Page className="m-auto flex w-full max-w-lg flex-col items-center gap-y-8">
      <Card className="w-full text-center">
        <CardHeader className="items-center">
          <CircleCheck className="size-12 text-green-500" />

          <CardTitle className="text-2xl">
            <Trans>You're all set!</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>
              Thank you for subscribing to Bahar Pro. You now have access to all
              Pro features.
            </Trans>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button asChild>
            <Link to="/">
              <Trans>Go to dictionary</Trans>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </Page>
  );
};

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/checkout-success"
)({
  component: CheckoutSuccess,
});
