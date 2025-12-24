import { Trans } from "@lingui/react/macro";
import { motion } from "motion/react";
import { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlashcardWithDictionaryEntry,
} from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";
import { CheckCircle2 } from "lucide-react";

/**
 * This displays the back side of the flashcard which contains
 * the translation and any other fields the user has configured
 * to be displayed. This is the side which will prompt the user
 * to grade the flashcard.
 */
export const AnswerSide: FC<{ currentCard: FlashcardWithDictionaryEntry }> = ({
  currentCard,
}) => {
  const { data: flashcardSettings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  /**
   * Antonym Conditions
   */
  const hasAntonyms = !!currentCard.dictionary_entry.antonyms?.length;
  const showAntonyms = flashcardSettings?.show_antonyms_in_flashcard;

  return (
    <motion.div
      className="flex flex-col gap-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {/* Answer indicator */}
      <motion.div
        className="flex items-center gap-2 text-green-600 dark:text-green-400"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-medium uppercase tracking-wide">
          <Trans>Answer</Trans>
        </span>
      </motion.div>

      {/* Definition in Arabic */}
      {!!currentCard.dictionary_entry.definition && (
        <motion.p
          dir="rtl"
          className="text-lg sm:text-xl text-muted-foreground rtl:text-right"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <span className="text-muted-foreground/60">المعنى:</span>{" "}
          {currentCard.dictionary_entry.definition}
        </motion.p>
      )}

      {/* Antonyms */}
      {showAntonyms === "answer" && hasAntonyms && (
        <motion.p
          dir="rtl"
          className="rtl:text-right text-base sm:text-lg text-muted-foreground italic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          أضداد:{" "}
          {currentCard.dictionary_entry.antonyms
            ?.map((antonym) => antonym.word)
            .join(", ")}
        </motion.p>
      )}

      {/* Translation - the main answer */}
      <motion.p
        dir="ltr"
        className="text-xl sm:text-2xl text-foreground/90 ltr:text-left"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        {currentCard.dictionary_entry.translation}
      </motion.p>
    </motion.div>
  );
};
