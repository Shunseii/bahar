import { motion } from "motion/react";
import { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlashcardWithDictionaryEntry,
} from "@/lib/db/operations/flashcards";
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
    <motion.span
      className="text-base sm:text-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!!currentCard.dictionary_entry.definition && (
        <p dir="rtl">المعنى: {currentCard.dictionary_entry.definition}</p>
      )}

      {showAntonyms === "answer" && hasAntonyms && (
        <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
          أضداد:{" "}
          {currentCard.dictionary_entry.antonyms
            ?.map((antonym) => antonym.word)
            .join(", ")}
        </p>
      )}

      <p dir="ltr">{currentCard.dictionary_entry.translation}</p>
    </motion.span>
  );
};
