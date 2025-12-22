import { useAtomValue } from "jotai";
import { isSyncingAtom } from "@/atoms/sync";
import { Cloud } from "lucide-react";
import { cn } from "@bahar/design-system";

export const SyncIndicator = () => {
  const isSyncing = useAtomValue(isSyncingAtom);

  if (!isSyncing) return null;

  return (
    <div className="fixed bottom-4 ltr:right-4 rtl:left-4 z-50">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full",
          "bg-background/80 backdrop-blur-sm border shadow-lg",
          "text-muted-foreground text-sm"
        )}
      >
        <Cloud className="w-4 h-4 animate-pulse" />
        <span className="sr-only">Syncing...</span>
      </div>
    </div>
  );
};
