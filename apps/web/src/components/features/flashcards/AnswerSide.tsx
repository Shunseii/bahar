import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { FC } from "react";
import { Flashcard } from "./FlashcardDrawer";

/**
 * This displays the back side of the flashcard which contains
 * the translation and any other fields the user has configured
 * to be displayed. This is the side which will prompt the user
 * to grade the flashcard.
 */
export const AnswerSide: FC<{ currentCard: Flashcard }> = ({ currentCard }) => {
  const { data: flashcardSettings } = trpc.settings.get.useQuery();

  /**
   * Antonym Conditions
   */
  const hasAntonyms = !!currentCard?.card?.antonyms?.length;
  const showAntonyms = flashcardSettings?.show_antonyms_in_flashcard;

  return (
    <motion.span
      className="text-base sm:text-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!!currentCard.card.definition && (
        <p dir="rtl">المعنى: {currentCard.card.definition}</p>
      )}

      {showAntonyms === "answer" && hasAntonyms && (
        <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
          أضداد:{" "}
          {currentCard.card.antonyms?.map((antonym) => antonym.word).join(", ")}
        </p>
      )}

      <p dir="ltr">{currentCard.card.translation}</p>
    </motion.span>
  );
};
