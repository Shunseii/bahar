import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import type {
  CardFace as CardFaceKey,
  CardFieldId,
  CardLayout,
} from "@bahar/drizzle-user-db-schemas";
import { REQUIRED_FIELD_BY_FACE } from "@bahar/drizzle-user-db-schemas";
import { motion } from "motion/react";
import type { FC } from "react";
import { useCardFace } from "@/hooks/useCardFace";

type FieldProps = {
  currentCard: FlashcardWithDictionaryEntry;
  delay: number;
  /** Set on the field the face leads with, which renders at prompt size. */
  isPrompt: boolean;
  promptClassName: string;
};

const SECONDARY_ARABIC_CLASS =
  "text-lg text-muted-foreground sm:text-xl rtl:text-right";

const WordField: FC<FieldProps> = ({
  currentCard,
  delay,
  isPrompt,
  promptClassName,
}) => (
  <motion.p
    animate={{ opacity: 1, scale: 1 }}
    className={isPrompt ? promptClassName : SECONDARY_ARABIC_CLASS}
    dir="rtl"
    initial={{ opacity: 0, scale: 0.95 }}
    transition={{ delay, duration: 0.3 }}
  >
    {currentCard.dictionary_entry.word}
  </motion.p>
);

const TranslationField: FC<FieldProps> = ({
  currentCard,
  delay,
  isPrompt,
  promptClassName,
}) => (
  <motion.p
    animate={{ opacity: 1, scale: 1 }}
    className={
      isPrompt
        ? promptClassName
        : "text-base text-muted-foreground sm:text-lg ltr:text-left"
    }
    dir="ltr"
    initial={{ opacity: 0, scale: 0.95 }}
    transition={{ delay, duration: 0.3 }}
  >
    {currentCard.dictionary_entry.translation}
  </motion.p>
);

const DefinitionField: FC<FieldProps> = ({ currentCard, delay }) => {
  if (!currentCard.dictionary_entry.definition) return null;

  return (
    <motion.p
      animate={{ opacity: 1 }}
      className={SECONDARY_ARABIC_CLASS}
      dir="rtl"
      initial={{ opacity: 0 }}
      transition={{ delay }}
    >
      <span className="text-muted-foreground/60">المعنى:</span>{" "}
      {currentCard.dictionary_entry.definition}
    </motion.p>
  );
};

const MorphologyField: FC<FieldProps> = ({ currentCard, delay }) => {
  const { type, morphology } = currentCard.dictionary_entry;

  const isIsm = type === "ism";
  const isVerb = type === "fi'l";

  const chips = [
    isIsm && morphology?.ism?.plurals?.[0]?.word
      ? `(ج) ${morphology.ism.plurals[0].word}`
      : null,
    isIsm && morphology?.ism?.singular
      ? `(م) ${morphology.ism.singular}`
      : null,
    isVerb ? (morphology?.verb?.masadir?.[0]?.word ?? null) : null,
    isVerb ? (morphology?.verb?.present_tense ?? null) : null,
    isVerb ? (morphology?.verb?.past_tense ?? null) : null,
  ].filter((chip): chip is string => !!chip);

  if (chips.length === 0) return null;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex flex-wrap items-center gap-2 ltr:self-end rtl:flex-row-reverse rtl:self-start"
      initial={{ opacity: 0 }}
      transition={{ delay }}
    >
      {chips.map((chip) => (
        <span
          className="rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl rtl:text-right"
          dir="rtl"
          key={chip}
        >
          {chip}
        </span>
      ))}
    </motion.div>
  );
};

const RootField: FC<FieldProps> = ({ currentCard, delay }) => {
  const { root, type } = currentCard.dictionary_entry;

  if (type !== "fi'l" || !root) return null;

  return (
    <motion.p
      animate={{ opacity: 1 }}
      className="text-lg text-muted-foreground/70 tracking-wider sm:text-xl rtl:text-right"
      dir="rtl"
      initial={{ opacity: 0 }}
      transition={{ delay }}
    >
      {root.join(" - ")}
    </motion.p>
  );
};

const ExamplesField: FC<FieldProps> = ({ currentCard, delay }) => {
  const sentence = currentCard.dictionary_entry.examples?.[0]?.sentence;

  if (!sentence) return null;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex flex-col gap-y-1 pt-2"
      initial={{ opacity: 0 }}
      transition={{ delay }}
    >
      <p className="text-base text-muted-foreground sm:text-lg" dir="rtl">
        {sentence}
      </p>
    </motion.div>
  );
};

const AntonymsField: FC<FieldProps> = ({ currentCard, delay }) => {
  const antonyms = currentCard.dictionary_entry.antonyms;

  if (!antonyms?.length) return null;

  return (
    <motion.p
      animate={{ opacity: 1 }}
      className="text-base text-muted-foreground italic sm:text-lg rtl:text-right"
      dir="rtl"
      initial={{ opacity: 0 }}
      transition={{ delay }}
    >
      أضداد: {antonyms.map((antonym) => antonym.word).join(", ")}
    </motion.p>
  );
};

/**
 * Tags render above the card rather than inside a face, so the drawer owns them
 * (see `FlashcardDrawer`). Keeping the id in the registry lets the settings
 * editor list it like any other field.
 */
const TagsField: FC<FieldProps> = () => null;

const FIELD_RENDERERS: Record<CardFieldId, FC<FieldProps>> = {
  word: WordField,
  translation: TranslationField,
  definition: DefinitionField,
  morphology: MorphologyField,
  root: RootField,
  examples: ExamplesField,
  antonyms: AntonymsField,
  tags: TagsField,
};

const PROMPT_CLASS_BY_FACE: Record<CardFaceKey, string> = {
  forward_question:
    "text-2xl text-foreground/90 leading-relaxed sm:text-3xl rtl:text-right",
  forward_answer: "text-foreground/90 text-xl sm:text-2xl ltr:text-left",
  reverse_question:
    "text-2xl text-foreground/90 leading-relaxed sm:text-3xl ltr:text-left",
  reverse_answer:
    "text-2xl text-foreground/90 leading-relaxed sm:text-3xl rtl:text-right",
};

/**
 * Renders one side of a flashcard from the user's configured field order.
 */
export const CardFace: FC<{
  currentCard: FlashcardWithDictionaryEntry;
  face: CardFaceKey;
  className?: string;
  layoutOverride?: CardLayout | null;
}> = ({
  currentCard,
  face,
  className = "flex w-full flex-col gap-y-4",
  layoutOverride,
}) => {
  const fields = useCardFace(face, layoutOverride);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {fields.map((field, index) => {
        const Field = FIELD_RENDERERS[field];

        return (
          <Field
            currentCard={currentCard}
            delay={0.1 + index * 0.05}
            isPrompt={field === REQUIRED_FIELD_BY_FACE[face]}
            key={field}
            promptClassName={PROMPT_CLASS_BY_FACE[face]}
          />
        );
      })}
    </motion.div>
  );
};
