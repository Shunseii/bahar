import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Activity, Globe } from "lucide-react-native";
import { Linking, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useThemeColors } from "@/lib/theme";

export default function StatsScreen() {
  const colors = useThemeColors();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader icon={Activity} title={t`Progress`} />

      <View className="flex-1 items-center justify-center px-8">
        <Card className="w-full">
          <CardContent className="items-center py-8">
            <View className="mb-4 rounded-full bg-primary/10 p-4">
              <Activity color={colors.primary} size={32} />
            </View>
            <Text className="mb-2 text-center font-semibold text-foreground text-lg">
              <Trans>Coming soon on mobile</Trans>
            </Text>
            <Text className="mb-6 text-center text-muted-foreground text-sm">
              <Trans>
                View your learning stats, streaks, and review history on the web
                app for now.
              </Trans>
            </Text>
            <Button
              Icon={Globe}
              onPress={() => Linking.openURL("https://bahar.dev")}
              variant="outline"
            >
              <Trans>Open web app</Trans>
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}
