import { Badge } from "@bahar/web-ui/components/badge";
import { Button } from "@bahar/web-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { authClient } from "@/lib/auth-client";

export const BillingSettingsCard = () => {
  const { t } = useLingui();
  const { planStatus, isProUser, isFreeUser } = useUserPlan();

  const getLocalizedPlanName = () => {
    if (planStatus === "pro") return t`Pro`;
    if (planStatus === "free") return t`Free`;
    if (planStatus === "offline") return t`Unavailable offline`;
    return "";
  };

  const handleManageSubscription = useCallback(async () => {
    await authClient.customer.portal();
  }, []);

  return (
    <Card>
      <CardHeader id="billing">
        <CardTitle>
          <Trans>Billing</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>Manage your subscription.</Trans>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col">
            <p className="font-light text-muted-foreground text-sm">
              <Trans>Current plan</Trans>
            </p>

            <p className="font-semibold text-xl">{getLocalizedPlanName()}</p>
          </div>

          {isProUser && (
            <Button onClick={handleManageSubscription} variant="outline">
              <Trans>Manage Subscription</Trans>
            </Button>
          )}
        </div>

        {isFreeUser && (
          <div className="flex flex-col gap-y-2">
            <h2 className="font-semibold">
              <Trans>Upgrade to Pro</Trans>
            </h2>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1 py-6"
                onClick={async () => {
                  await authClient.checkout({ slug: "pro" });
                }}
                variant="outline"
              >
                <div className="flex flex-col">
                  <p className="font-semibold text-sm">
                    <Trans>Monthly — $10/mo</Trans>
                  </p>

                  <p className="font-light text-muted-foreground text-xs">
                    <Trans>Billed monthly</Trans>
                  </p>
                </div>
              </Button>

              <Button
                className="flex-1 py-6"
                onClick={async () => {
                  await authClient.checkout({ slug: "pro_annual" });
                }}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">
                    <Trans>Annual — $7/mo</Trans>
                    <span className="ml-2">
                      <Badge
                        className="font-medium text-xs"
                        variant="secondary"
                      >
                        <Trans>Save 30%</Trans>
                      </Badge>
                    </span>
                  </span>

                  <p className="font-light text-muted text-xs">
                    <Trans>Billed $84/year</Trans>
                  </p>
                </div>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
