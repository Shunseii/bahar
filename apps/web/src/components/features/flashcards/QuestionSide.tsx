import { motion } from "motion/react";
import { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlashcardWithDictionaryEntry,
} from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";

/**
 * This displays the front side of the flashcard which contains
 * the Arabic word and any other fields the user has configured
 * to be displayed.
 */
export const QuestionSide: FC<{
  currentCard: FlashcardWithDictionaryEntry;
}> = ({ currentCard }) => {
  const { data: flashcardSettings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  const root = currentCard?.dictionary_entry.root;

  /**
   * Ism Conditions
   */
  const isIsm = currentCard?.dictionary_entry.type === "ism";
  const firstPlural =
    currentCard?.dictionary_entry.morphology?.ism?.plurals?.[0]?.word;
  const singular = currentCard?.dictionary_entry.morphology?.ism?.singular;
  const hasPlurals = isIsm && !!firstPlural;
  const hasSingular = isIsm && !!singular;

  /**
   * Verb Conditions
   */
  const isVerb = currentCard?.dictionary_entry.type === "fi'l";
  const pastTense = currentCard?.dictionary_entry.morphology?.verb?.past_tense;
  const presentTense =
    currentCard?.dictionary_entry.morphology?.verb?.present_tense;
  const hasPastTense = isVerb && !!pastTense;
  const hasPresentTense = isVerb && !!presentTense;

  /**
   * Masdar Conditions
   */
  const firstMasdar =
    currentCard?.dictionary_entry.morphology?.verb?.masadir?.[0]?.word;
  const hasMasdar = isVerb && !!firstMasdar;

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
      {/* Main word - large and prominent */}
      <motion.p
        dir="rtl"
        className="rtl:text-right text-2xl sm:text-3xl text-foreground/90 leading-relaxed"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {currentCard.dictionary_entry.word}
      </motion.p>

      {/* Morphology details */}
      <motion.div
        className="flex flex-wrap gap-2 items-center ltr:self-end rtl:self-start rtl:flex-row-reverse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {hasPlurals && (
          <span
            dir="rtl"
            className="rtl:text-right text-lg sm:text-xl text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50"
          >
            (ج) {firstPlural}
          </span>
        )}
        {hasSingular && (
          <span
            dir="rtl"
            className="rtl:text-right text-lg sm:text-xl text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50"
          >
            (م) {singular}
          </span>
        )}

        {hasMasdar && (
          <span
            dir="rtl"
            className="rtl:text-right text-lg sm:text-xl text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50"
          >
            {firstMasdar}
          </span>
        )}

        {hasPresentTense && (
          <span
            dir="rtl"
            className="rtl:text-right text-lg sm:text-xl text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50"
          >
            {presentTense}
          </span>
        )}

        {hasPastTense && (
          <span
            dir="rtl"
            className="rtl:text-right text-lg sm:text-xl text-muted-foreground px-2 py-0.5 rounded-md bg-muted/50"
          >
            {pastTense}
          </span>
        )}
      </motion.div>

      {isVerb && root && (
        <motion.p
          dir="rtl"
          className="rtl:text-right text-lg sm:text-xl text-muted-foreground/70 tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {root.join(" - ")}
        </motion.p>
      )}

      {showAntonyms === "hint" && hasAntonyms && (
        <motion.p
          dir="rtl"
          className="rtl:text-right text-base sm:text-lg text-muted-foreground italic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
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
