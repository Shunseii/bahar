import { trpc } from "@/lib/trpc";
import { motion } from "motion/react";
import { FC } from "react";
import { Flashcard } from "./FlashcardDrawer";

/**
 * This displays the front side of the flashcard which contains
 * the Arabic word and any other fields the user has configured
 * to be displayed.
 */
export const QuestionSide: FC<{ currentCard: Flashcard }> = ({
  currentCard,
}) => {
  const { data: flashcardSettings } = trpc.settings.get.useQuery();

  const root = currentCard?.card.root;

  /**
   * Ism Conditions
   */
  const isIsm = currentCard?.card.type === "ism";
  const firstPlural = currentCard?.card.morphology?.ism?.plurals?.[0]?.word;
  const singular = currentCard?.card.morphology?.ism?.singular;
  const hasPlurals = isIsm && !!firstPlural;
  const hasSingular = isIsm && !!singular;

  /**
   * Verb Conditions
   */
  const isVerb = currentCard?.card.type === "fi'l";
  const pastTense = currentCard?.card.morphology?.verb?.past_tense;
  const presentTense = currentCard?.card.morphology?.verb?.present_tense;
  const hasPastTense = isVerb && !!pastTense;
  const hasPresentTense = isVerb && !!presentTense;

  /**
   * Masdar Conditions
   */
  const firstMasdar = currentCard?.card.morphology?.verb?.masadir?.[0]?.word;
  const hasMasdar = isVerb && !!firstMasdar;

  /**
   * Antonym Conditions
   */
  const hasAntonyms = !!currentCard?.card?.antonyms?.length;
  const showAntonyms = flashcardSettings?.show_antonyms_in_flashcard;

  return (
    <motion.span
      className="w-full flex flex-col gap-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p dir="rtl" className="rtl:text-right text-xl sm:text-2xl">
        {currentCard.card.word}
      </p>

      <div className="flex gap-x-2 items-center ltr:self-end rtl:self-start rtl:flex-row-reverse">
        {hasPlurals && (
          <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
            (ج) {firstPlural}
          </p>
        )}
        {hasSingular && (
          <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
            (م) {singular}
          </p>
        )}

        {hasMasdar && (
          <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
            {firstMasdar}
          </p>
        )}

        {hasPresentTense && (
          <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
            {presentTense}
          </p>
        )}

        {hasPastTense && (
          <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
            {pastTense}
          </p>
        )}
      </div>

      {isVerb && root && (
        <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
          {root.join("-")}
        </p>
      )}

      {showAntonyms === "hint" && hasAntonyms && (
        <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
          أضداد:{" "}
          {currentCard.card.antonyms?.map((antonym) => antonym.word).join(", ")}
        </p>
      )}
    </motion.span>
  );
};
