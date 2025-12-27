import { useAtomValue } from "jotai";
import { Cloud } from "lucide-react-native";
import { View } from "react-native";
import { isSyncingAtom } from "@/lib/store";

export const SyncIndicator = () => {
  const isSyncing = useAtomValue(isSyncingAtom);

  if (!isSyncing) return null;

  return (
    <View
      accessibilityLabel="Syncing"
      accessibilityRole="status"
      className="absolute right-4 bottom-20 z-50"
    >
      <View className="flex-row items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-2 shadow-lg">
        <Cloud className="text-muted-foreground" size={16} />
      </View>
    </View>
  );
};
