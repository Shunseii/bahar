import { Trans } from "@lingui/react/macro";
import { Lock } from "lucide-react-native";
import type { FC } from "react";
import { Linking, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useThemeColors } from "@/lib/theme";

export const ProPlaceholder: FC = () => {
  const colors = useThemeColors();

  return (
    <Card>
      <CardContent className="items-center py-6">
        <View className="mb-3 rounded-full bg-muted p-3">
          <Lock color={colors.mutedForeground} size={24} />
        </View>
        <Text className="font-semibold text-foreground text-lg">
          <Trans>Unlock Insights</Trans>
        </Text>
        <Text className="mt-1 text-center text-muted-foreground text-sm">
          <Trans>
            See your retention rate, workload forecast, difficult words, and
            more.
          </Trans>
        </Text>
        <View className="mt-4 w-full">
          <Button onPress={() => Linking.openURL("https://bahar.dev/settings")}>
            <Trans>Upgrade to Pro</Trans>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
};
