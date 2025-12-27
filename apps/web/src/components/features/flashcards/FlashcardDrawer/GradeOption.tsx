import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import { Brain, RotateCcw, ThumbsUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import { type FC, type ReactNode, useMemo } from "react";
import { Rating } from "ts-fsrs";
import { Button } from "@/components/ui/button";

type ReviewRating = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

type GradeOptionConfig = {
  label: ReactNode;
  borderStyles: string;
  glowColor: string;
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
        glowColor: "hover:shadow-muted-foreground/20",
        icon: (
          <RotateCcw className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:rotate-[-30deg] group-hover:text-foreground" />
        ),
      },
      [Rating.Hard]: {
        label: <Trans>Hard</Trans>,
        borderStyles:
          "border-orange-500/30 hover:border-orange-500/50 hover:bg-orange-500/10",
        glowColor: "hover:shadow-orange-500/25",
        icon: (
          <Brain className="h-5 w-5 text-orange-500 transition-transform duration-300 group-hover:scale-110" />
        ),
      },
      [Rating.Good]: {
        label: <Trans>Good</Trans>,
        borderStyles:
          "border-primary/30 hover:border-primary/50 hover:bg-primary/10",
        glowColor: "hover:shadow-primary/25",
        icon: (
          <ThumbsUp className="h-5 w-5 text-primary transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
        ),
      },
      [Rating.Easy]: {
        label: <Trans>Easy</Trans>,
        borderStyles:
          "border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10",
        glowColor: "hover:shadow-green-500/25",
        icon: (
          <Zap className="h-5 w-5 text-green-500 transition-transform duration-300 group-hover:scale-110" />
        ),
      },
    };

    return config;
  }, []);

  const { label, icon, borderStyles, glowColor } = options[grade];

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1"
      initial={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: 0.05 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Button
        className={cn(
          "group h-auto w-full flex-col gap-1 border-2 px-2 py-3 shadow-md transition-all duration-300 sm:px-4",
          "hover:shadow-lg",
          borderStyles,
          glowColor
        )}
        disabled={disabled}
        onClick={onClick}
        variant="outline"
      >
        {icon}
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground text-xs">{intervalLabel}</span>
      </Button>
    </motion.div>
  );
};
