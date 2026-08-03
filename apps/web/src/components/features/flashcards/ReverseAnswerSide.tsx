import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import type { CardLayout } from "@bahar/drizzle-user-db-schemas";
import { Trans } from "@lingui/react/macro";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import type { FC } from "react";
import { CardFace } from "./CardFace";

/**
 * This displays the back side of the reverse flashcard which
 * contains the Arabic word and any other fields the user has
 * configured to be displayed.
 */
export const ReverseAnswerSide: FC<{
  currentCard: FlashcardWithDictionaryEntry;
  layoutOverride?: CardLayout | null;
}> = ({ currentCard, layoutOverride }) => (
  <div className="flex w-full flex-col gap-y-4">
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 text-green-600 dark:text-green-400"
      initial={{ opacity: 0, x: -10 }}
      transition={{ delay: 0.1 }}
    >
      <CheckCircle2 className="h-4 w-4" />
      <span className="font-medium text-sm uppercase tracking-wide">
        <Trans>Answer</Trans>
      </span>
    </motion.div>

    <CardFace
      currentCard={currentCard}
      face="reverse_answer"
      layoutOverride={layoutOverride}
    />
  </div>
);
