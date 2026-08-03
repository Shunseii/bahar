import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CardAppearanceSection } from "@/components/settings/CardAppearanceSection";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { useThemeColors } from "@/lib/theme";

/**
 * Its own screen rather than another card in settings: the editor holds a draft
 * until you save it, which is the only unsaved state on that screen, and the
 * field list needs the height.
 */
export default function CardAppearanceScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { scrollHandler } = useCollapsibleHeader(t`Card appearance`);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-safe-offset-6"
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      <View className="flex-1 gap-y-4 px-4 pt-4">
        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityLabel={t`Go back`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
          >
            <ChevronLeft color={colors.foreground} size={24} />
          </Pressable>
          <Text className="flex-1 font-semibold text-foreground text-xl tracking-tight">
            <Trans>Card appearance</Trans>
          </Text>
        </View>

        <CardAppearanceSection />
      </View>
    </ScrollView>
  );
}
