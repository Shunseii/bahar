import { trpc } from "@/lib/trpc";
import { motion } from "motion/react";
import { FC } from "react";
import { Flashcard } from "./FlashcardDrawer";

/**
 * This displays the front side of the reverse flashcard which
 * contains the translation and any other fields the user has
 * been configured to be displayed.
 */
export const ReverseQuestionSide: FC<{ currentCard: Flashcard }> = ({
  currentCard,
}) => {
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
      <p dir="ltr">{currentCard.card.translation}</p>

      {!!currentCard.card.definition && (
        <p dir="rtl">المعنى: {currentCard.card.definition}</p>
      )}

      {showAntonyms === "answer" && hasAntonyms && (
        <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
          أضداد:{" "}
          {currentCard.card.antonyms?.map((antonym) => antonym.word).join(", ")}
        </p>
      )}
    </motion.span>
  );
};
