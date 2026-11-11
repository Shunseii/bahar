import { Card, CardContent } from "@bahar/web-ui/components/card";
import { Trans } from "@lingui/react/macro";
import { WifiOff } from "lucide-react";

/**
 * Stands in for the Pro upsell while offline: the plan can't be checked
 * without the server, so this names what needs a connection instead of
 * asking someone who may already be Pro to upgrade.
 */
export function OfflinePlaceholder() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-6">
        <WifiOff className="mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="font-semibold text-lg">
          <Trans>Insights need a connection</Trans>
        </h3>
        <p className="mt-1 text-center text-muted-foreground text-sm">
          <Trans>
            Retention rate, workload forecast and difficult words load once
            you're back online.
          </Trans>
        </p>
      </CardContent>
    </Card>
  );
}
