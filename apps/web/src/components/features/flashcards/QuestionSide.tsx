import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { FC } from "react";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations/flashcards";
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
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col gap-y-4"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {/* Main word - large and prominent */}
      <motion.p
        animate={{ opacity: 1, scale: 1 }}
        className="text-2xl text-foreground/90 leading-relaxed sm:text-3xl rtl:text-right"
        dir="rtl"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {currentCard.dictionary_entry.word}
      </motion.p>

      {/* Morphology details */}
      <motion.div
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center gap-2 ltr:self-end rtl:flex-row-reverse rtl:self-start"
        initial={{ opacity: 0 }}
        transition={{ delay: 0.2 }}
      >
        {hasPlurals && (
          <span
            className="rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl rtl:text-right"
            dir="rtl"
          >
            (ج) {firstPlural}
          </span>
        )}
        {hasSingular && (
          <span
            className="rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl rtl:text-right"
            dir="rtl"
          >
            (م) {singular}
          </span>
        )}

        {hasMasdar && (
          <span
            className="rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl rtl:text-right"
            dir="rtl"
          >
            {firstMasdar}
          </span>
        )}

        {hasPresentTense && (
          <span
            className="rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl rtl:text-right"
            dir="rtl"
          >
            {presentTense}
          </span>
        )}

        {hasPastTense && (
          <span
            className="rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl rtl:text-right"
            dir="rtl"
          >
            {pastTense}
          </span>
        )}
      </motion.div>

      {isVerb && root && (
        <motion.p
          animate={{ opacity: 1 }}
          className="text-lg text-muted-foreground/70 tracking-wider sm:text-xl rtl:text-right"
          dir="rtl"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.25 }}
        >
          {root.join(" - ")}
        </motion.p>
      )}

      {showAntonyms === "hint" && hasAntonyms && (
        <motion.p
          animate={{ opacity: 1 }}
          className="text-base text-muted-foreground italic sm:text-lg rtl:text-right"
          dir="rtl"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.3 }}
        >
          أضداد:{" "}
          {currentCard.dictionary_entry.antonyms
            ?.map((antonym) => antonym.word)
            .join(", ")}
        </motion.p>
      )}

      {/* Example sentence */}
      {!!currentCard.dictionary_entry.examples?.[0]?.sentence && (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex flex-col gap-y-1 pt-2"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-base text-muted-foreground sm:text-lg" dir="rtl">
            {currentCard.dictionary_entry.examples[0].sentence}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
