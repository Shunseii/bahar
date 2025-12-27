import { Button } from "@/components/ui/button";
import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import { Brain, RotateCcw, ThumbsUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import { FC, ReactNode, useMemo } from "react";
import { Rating } from "ts-fsrs";

type ReviewRating = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

type GradeOptionConfig = {
  label: ReactNode;
  borderStyles: string;
  icon: ReactNode;
};

type GradeOptionProps = {
  grade: ReviewRating;
  disabled?: boolean;
  intervalLabel: string;
  onClick: () => void;
};

export const GradeOption: FC<GradeOptionProps> = ({
  grade,
  onClick,
  intervalLabel,
  disabled = false,
}) => {
  const options = useMemo(() => {
    const config: Record<ReviewRating, GradeOptionConfig> = {
      [Rating.Again]: {
        label: <Trans>Again</Trans>,
        borderStyles:
          "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/50",
        icon: (
          <RotateCcw className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        ),
      },
      [Rating.Hard]: {
        label: <Trans>Hard</Trans>,
        borderStyles:
          "border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/10",
        icon: <Brain className="w-5 h-5 text-orange-500" />,
      },
      [Rating.Good]: {
        label: <Trans>Good</Trans>,
        borderStyles:
          "border-primary/30 hover:border-primary/50 hover:bg-primary/10",
        icon: <ThumbsUp className="w-5 h-5 text-primary" />,
      },
      [Rating.Easy]: {
        label: <Trans>Easy</Trans>,
        borderStyles:
          "border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10",
        icon: <Zap className="w-5 h-5 text-green-500" />,
      },
    };

    return config;
  }, []);

  const { label, icon, borderStyles } = options[grade];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 }}
      className="flex-1"
    >
      <Button
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full h-auto flex-col gap-1 py-3 px-2 sm:px-4 border-2 transition-all duration-200 group",
          borderStyles,
        )}
      >
        {icon}
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{intervalLabel}</span>
      </Button>
    </motion.div>
  );
};
