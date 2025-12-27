import { cn } from "@bahar/design-system";
import { useAtomValue } from "jotai";
import { Cloud } from "lucide-react";
import { isSyncingAtom } from "@/atoms/sync";

export const SyncIndicator = () => {
  const isSyncing = useAtomValue(isSyncingAtom);

  if (!isSyncing) return null;

  return (
    <div className="fixed bottom-4 z-50 ltr:right-4 rtl:left-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-2",
          "border bg-background/80 shadow-lg backdrop-blur-sm",
          "text-muted-foreground text-sm"
        )}
      >
        <Cloud className="h-4 w-4 animate-pulse" />
        <span className="sr-only">Syncing...</span>
      </div>
    </div>
  );
};
