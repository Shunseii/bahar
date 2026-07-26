import { Trans } from "@lingui/react/macro";
import { RotateCw } from "lucide-react-native";
import type { FC } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";

interface UpdateRestartModalProps {
  visible: boolean;
  onRestart: () => void;
  onLater: () => void;
}

export const UpdateRestartModal: FC<UpdateRestartModalProps> = ({
  visible,
  onRestart,
  onLater,
}) => {
  const { primary } = useThemeColors();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onLater}
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-black/65 px-10">
        <View className="w-full items-center gap-3.5 rounded-2xl bg-card p-6 shadow-lg">
          <View className="size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <RotateCw color={primary} size={26} />
          </View>

          <Text className="font-bold text-card-foreground text-lg">
            <Trans>Update ready</Trans>
          </Text>

          <Text className="text-center text-muted-foreground text-sm leading-5">
            <Trans>Restart Bahar to apply the latest version.</Trans>
          </Text>

          <View className="w-full flex-row gap-3">
            <Pressable
              className="flex-1"
              onPress={onLater}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="h-12 items-center justify-center rounded-lg bg-secondary">
                <Text className="font-semibold text-secondary-foreground text-sm">
                  <Trans>Later</Trans>
                </Text>
              </View>
            </Pressable>

            <Pressable
              className="flex-1"
              onPress={onRestart}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="h-12 items-center justify-center rounded-lg bg-primary">
                <Text className="font-semibold text-primary-foreground text-sm">
                  <Trans>Restart now</Trans>
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
