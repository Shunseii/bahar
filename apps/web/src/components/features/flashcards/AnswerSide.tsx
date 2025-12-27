import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import type { FC } from "react";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";

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
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-y-3"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {/* Answer indicator */}
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

      {/* Definition in Arabic */}
      {!!currentCard.dictionary_entry.definition && (
        <motion.p
          animate={{ opacity: 1 }}
          className="text-lg text-muted-foreground sm:text-xl rtl:text-right"
          dir="rtl"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className="text-muted-foreground/60">المعنى:</span>{" "}
          {currentCard.dictionary_entry.definition}
        </motion.p>
      )}

      {/* Antonyms */}
      {showAntonyms === "answer" && hasAntonyms && (
        <motion.p
          animate={{ opacity: 1 }}
          className="text-base text-muted-foreground italic sm:text-lg rtl:text-right"
          dir="rtl"
          initial={{ opacity: 0 }}
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
        animate={{ opacity: 1, scale: 1 }}
        className="text-foreground/90 text-xl sm:text-2xl ltr:text-left"
        dir="ltr"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        {currentCard.dictionary_entry.translation}
      </motion.p>
    </motion.div>
  );
};
