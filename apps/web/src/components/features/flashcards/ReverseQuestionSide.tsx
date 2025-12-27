import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { FC } from "react";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";

/**
 * This displays the front side of the reverse flashcard which
 * contains the translation and any other fields the user has
 * been configured to be displayed.
 */
export const ReverseQuestionSide: FC<{
  currentCard: FlashcardWithDictionaryEntry;
}> = ({ currentCard }) => {
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
      className="flex w-full flex-col gap-y-4"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {/* Main translation - large and prominent */}
      <motion.p
        animate={{ opacity: 1, scale: 1 }}
        className="text-2xl text-foreground/90 leading-relaxed sm:text-3xl ltr:text-left"
        dir="ltr"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {currentCard.dictionary_entry.translation}
      </motion.p>

      {/* Definition in Arabic */}
      {!!currentCard.dictionary_entry.definition && (
        <motion.p
          animate={{ opacity: 1 }}
          className="text-lg text-muted-foreground sm:text-xl rtl:text-right"
          dir="rtl"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.2 }}
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
          transition={{ delay: 0.25 }}
        >
          أضداد:{" "}
          {currentCard.dictionary_entry.antonyms
            ?.map((antonym) => antonym.word)
            .join(", ")}
        </motion.p>
      )}
    </motion.div>
  );
};
