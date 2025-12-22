import { useAtomValue } from "jotai";
import { View } from "react-native";
import { Cloud } from "lucide-react-native";
import { isSyncingAtom } from "@/lib/store";
import { useThemeColors } from "@/lib/theme";

export const SyncIndicator = () => {
  const isSyncing = useAtomValue(isSyncingAtom);
  const colors = useThemeColors();

  if (!isSyncing) return null;

  return (
    <View className="absolute bottom-20 right-4 z-50">
      <View className="flex-row items-center gap-2 px-3 py-2 rounded-full bg-background/90 border border-border shadow-lg">
        <Cloud size={16} color={colors.mutedForeground} />
      </View>
    </View>
  );
};
