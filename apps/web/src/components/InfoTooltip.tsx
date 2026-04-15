import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bahar/web-ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bahar/web-ui/components/tooltip";
import { Info } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

export const InfoTooltip: FC<{ children: ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Popover modal>
        <PopoverTrigger>
          <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
        </PopoverTrigger>
        <PopoverContent className="max-w-xs text-sm">{children}</PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
};
