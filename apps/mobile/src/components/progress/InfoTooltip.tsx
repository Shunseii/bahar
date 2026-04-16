import { Info } from "lucide-react-native";
import type { FC, PropsWithChildren } from "react";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";

export const InfoTooltip: FC<PropsWithChildren> = ({ children }) => {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable hitSlop={8} onPress={() => setVisible(true)}>
        <Info color={colors.mutedForeground} size={14} />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-8"
          onPress={() => setVisible(false)}
        >
          <View className="rounded-xl bg-card p-4 shadow-lg">
            <Text className="text-card-foreground text-sm leading-5">
              {children}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};
