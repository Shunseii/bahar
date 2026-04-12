import { Trans } from "@lingui/react/macro";
import { Activity, Globe } from "lucide-react-native";
import { Linking, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useThemeColors } from "@/lib/theme";

export default function StatsScreen() {
  const colors = useThemeColors();

  return (
    <View className="flex-1 bg-background">
      <View className="border-border border-b px-4 py-4">
        <View className="flex-row items-center gap-3">
          <View className="rounded-xl bg-primary/10 p-2">
            <Activity color={colors.primary} size={24} />
          </View>
          <Text className="font-bold text-2xl text-foreground">
            <Trans>Progress</Trans>
          </Text>
        </View>
      </View>

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
