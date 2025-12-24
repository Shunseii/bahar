import { motion } from "motion/react";
import { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlashcardWithDictionaryEntry,
} from "@/lib/db/operations/flashcards";
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
      className="w-full flex flex-col gap-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {/* Main translation - large and prominent */}
      <motion.p
        dir="ltr"
        className="ltr:text-left text-2xl sm:text-3xl text-foreground/90 leading-relaxed"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {currentCard.dictionary_entry.translation}
      </motion.p>

      {/* Definition in Arabic */}
      {!!currentCard.dictionary_entry.definition && (
        <motion.p
          dir="rtl"
          className="text-lg sm:text-xl text-muted-foreground rtl:text-right"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
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
