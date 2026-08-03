import { Trans } from "@lingui/react/macro";
import { LayoutTemplate } from "lucide-react-native";
import type React from "react";
import { Text, View } from "react-native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useThemeColors } from "@/lib/theme";
import { CardAppearanceEditor } from "./CardAppearanceEditor";

export const CardAppearanceSection: React.FC = () => {
  const colors = useThemeColors();

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <LayoutTemplate color={colors.mutedForeground} size={18} />
          <CardTitle>
            <Trans>Card appearance</Trans>
          </CardTitle>
        </View>
      </CardHeader>

      <CardContent className="gap-3">
        <Text className="text-muted-foreground text-sm">
          <Trans>
            This is your card. Tap a field to hide it, hold to reorder. Every
            entry makes a forward and a reverse card, each with two sides.
          </Trans>
        </Text>

        <CardAppearanceEditor />
      </CardContent>
    </Card>
  );
};
