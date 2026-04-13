import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";

export const GuestBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const { primaryForeground, primary, mutedForeground } = useThemeColors();

  if (dismissed) return null;

  return (
    <View className="gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <Text className="font-semibold text-foreground text-sm">
            <Trans>You're browsing as a guest</Trans>
          </Text>

          <Text className="text-muted-foreground text-xs">
            <Trans>
              Create an account to sync your words across devices and keep your
              progress safe.
            </Trans>
          </Text>
        </View>

        <Pressable
          hitSlop={8}
          onPress={() => setDismissed(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <X color={mutedForeground} size={18} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push("/link-account")}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <View className="items-center rounded-lg bg-primary py-2">
          <Text
            className="font-medium text-sm"
            style={{ color: primaryForeground }}
          >
            <Trans>Create Account</Trans>
          </Text>
        </View>
      </Pressable>
    </View>
  );
};
