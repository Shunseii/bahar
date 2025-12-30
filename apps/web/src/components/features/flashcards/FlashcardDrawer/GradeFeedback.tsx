import { cn } from "@bahar/design-system";
import { Brain, RotateCcw, ThumbsUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import { type FC, useEffect } from "react";
import { type Grade, Rating } from "ts-fsrs";

/**
 * Grade feedback animation overlay for flashcards.
 *
 * When the user selects a grade, this overlay animates on top of the flashcard.
 */
export const GradeFeedback: FC<{
  grade: Grade | null;
  onComplete: () => void;
}> = ({ grade, onComplete }) => {
  useEffect(() => {
    if (grade === null) return;

    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [grade, onComplete]);

  if (grade === null) return null;

  const feedbackConfig = {
    [Rating.Again]: {
      icon: RotateCcw,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      animation: {
        initial: { scale: 0, rotate: 0 },
        animate: {
          scale: [0, 1.2, 1],
          rotate: [0, -10, 10, -10, 0],
        },
        transition: { duration: 0.5 },
      },
    },
    [Rating.Hard]: {
      icon: Brain,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      animation: {
        initial: { scale: 0 },
        animate: {
          scale: [0, 1.3, 1],
          opacity: [0, 1, 1],
        },
        transition: { duration: 0.5, ease: "easeOut" },
      },
    },
    [Rating.Good]: {
      icon: ThumbsUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
      animation: {
        initial: { scale: 0, y: 10, opacity: 0 },
        animate: {
          scale: 1,
          y: 0,
          opacity: 1,
        },
        transition: {
          duration: 0.4,
          type: "spring",
          stiffness: 200,
          damping: 15,
        },
      },
    },
    [Rating.Easy]: {
      icon: Zap,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      animation: {
        initial: { scale: 0, rotate: -20 },
        animate: {
          scale: [0, 1.4, 1],
          rotate: [-20, 10, 0],
        },
        transition: { duration: 0.4, ease: "easeOut" },
      },
    },
  };

  const config = feedbackConfig[grade];
  const Icon = config.icon;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
    >
      {/* Background pulse */}
      <motion.div
        animate={{ opacity: [0, 0.5, 0] }}
        className={cn("absolute inset-0", config.bgColor)}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
      />

      {/* Icon animation */}
      <motion.div
        className={cn("rounded-full p-6", config.bgColor)}
        {...config.animation}
      >
        <Icon className={cn("h-16 w-16", config.color)} />
      </motion.div>

      {/* Sparkles for Easy */}
      {grade === Rating.Easy &&
        [...new Array(6)].map((_, i) => (
          // biome-ignore lint/correctness/useJsxKeyInIterable: cant key on anything other than index
          <motion.div
            animate={{
              scale: [0, 1, 0],
              x: Math.cos((i * Math.PI * 2) / 6) * 80,
              y: Math.sin((i * Math.PI * 2) / 6) * 80,
              opacity: [0, 1, 0],
            }}
            className="absolute h-2 w-2 rounded-full bg-green-400"
            initial={{
              scale: 0,
              x: 0,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.1,
            }}
          />
        ))}
    </motion.div>
  );
};
