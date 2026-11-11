import { Trans } from "@lingui/react/macro";
import { WifiOff } from "lucide-react-native";
import type { FC } from "react";
import { Text, View } from "react-native";
import { Card, CardContent } from "@/components/ui/card";
import { useThemeColors } from "@/lib/theme";

/**
 * Stands in for the Pro upsell while offline: the plan can't be checked
 * without the server, so this names what needs a connection instead of
 * asking someone who may already be Pro to upgrade.
 */
export const OfflinePlaceholder: FC = () => {
  const colors = useThemeColors();

  return (
    <Card>
      <CardContent className="items-center py-6">
        <View className="mb-3 rounded-full bg-muted p-3">
          <WifiOff color={colors.mutedForeground} size={24} />
        </View>
        <Text className="font-semibold text-foreground text-lg">
          <Trans>Insights need a connection</Trans>
        </Text>
        <Text className="mt-1 text-center text-muted-foreground text-sm">
          <Trans>
            Retention rate, workload forecast and difficult words load once
            you're back online.
          </Trans>
        </Text>
      </CardContent>
    </Card>
  );
};
