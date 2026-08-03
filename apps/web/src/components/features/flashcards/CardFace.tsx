import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import type {
  CardFace as CardFaceKey,
  CardFieldId,
  CardLayout,
} from "@bahar/drizzle-user-db-schemas";
import { REQUIRED_FIELD_BY_FACE } from "@bahar/drizzle-user-db-schemas";
import { useLingui } from "@lingui/react/macro";
import { motion } from "motion/react";
import type { FC } from "react";
import { useCardFace } from "@/hooks/useCardFace";

type Entry = FlashcardWithDictionaryEntry["dictionary_entry"];

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

const CHIP_CLASS =
  "rounded-md bg-muted/50 px-2 py-0.5 text-lg text-muted-foreground sm:text-xl";

/** A single Arabic value shown as a chip, e.g. one plural or a past tense. */
const chipField =
  (read: (entry: Entry) => string | null | undefined, prefix?: string) =>
  ({ currentCard, delay }: FieldProps) => {
    const value = read(currentCard.dictionary_entry);

    if (!value) return null;

    return (
      <motion.div
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center gap-2 ltr:self-end rtl:self-start"
        initial={{ opacity: 0 }}
        transition={{ delay }}
      >
        <span className={`${CHIP_CLASS} rtl:text-right`} dir="rtl">
          {prefix ? `${prefix} ${value}` : value}
        </span>
      </motion.div>
    );
  };

/**
 * A translated word (the entry's type, gender or inflection) shown as a chip.
 * The label is resolved per render rather than at module load, so switching
 * language doesn't leave a stale string behind.
 */
const translatedChipField =
  (
    read: (entry: Entry, t: ReturnType<typeof useLingui>["t"]) => string | null
  ) =>
  ({ currentCard, delay }: FieldProps) => {
    const { t } = useLingui();
    const value = read(currentCard.dictionary_entry, t);

    if (!value) return null;

    return (
      <motion.div
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center gap-2 ltr:self-end rtl:self-start"
        initial={{ opacity: 0 }}
        transition={{ delay }}
      >
        <span className="rounded-md bg-muted/50 px-2 py-0.5 text-muted-foreground text-sm sm:text-base">
          {value}
        </span>
      </motion.div>
    );
  };

const HuroofField: FC<FieldProps> = ({ currentCard, delay }) => {
  const huroof = currentCard.dictionary_entry.morphology?.verb?.huroof;

  if (!huroof?.length) return null;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex flex-wrap items-center gap-2 ltr:self-end rtl:self-start"
      initial={{ opacity: 0 }}
      transition={{ delay }}
    >
      {huroof.map(({ harf, meaning }) => (
        <span className={CHIP_CLASS} dir="rtl" key={harf}>
          {harf}
          {meaning ? (
            <span className="text-muted-foreground/70 text-sm"> {meaning}</span>
          ) : null}
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

const ism = (entry: Entry) => entry.morphology?.ism;
const verb = (entry: Entry) => entry.morphology?.verb;

const FIELD_RENDERERS: Record<CardFieldId, FC<FieldProps>> = {
  tags: TagsField,
  word: WordField,
  translation: TranslationField,
  definition: DefinitionField,
  type: translatedChipField((entry, t) => {
    switch (entry.type) {
      case "ism":
        return t`Ism`;
      case "fi'l":
        return t`Fi'l`;
      case "harf":
        return t`Harf`;
      case "expression":
        return t`Expression`;
      default:
        return null;
    }
  }),
  gender: translatedChipField((entry, t) => {
    switch (ism(entry)?.gender) {
      case "masculine":
        return t`Masculine`;
      case "feminine":
        return t`Feminine`;
      default:
        return null;
    }
  }),
  inflection: translatedChipField((entry, t) => {
    switch (ism(entry)?.inflection) {
      case "triptote":
        return t`Triptote`;
      case "diptote":
        return t`Diptote`;
      case "indeclinable":
        return t`Indeclinable`;
      default:
        return null;
    }
  }),
  singular: chipField((entry) => ism(entry)?.singular, "(م)"),
  dual: chipField((entry) => ism(entry)?.dual, "(مث)"),
  plurals: chipField((entry) => ism(entry)?.plurals?.[0]?.word, "(ج)"),
  past_tense: chipField((entry) => verb(entry)?.past_tense),
  present_tense: chipField((entry) => verb(entry)?.present_tense),
  imperative: chipField((entry) => verb(entry)?.imperative),
  active_participle: chipField((entry) => verb(entry)?.active_participle),
  passive_participle: chipField((entry) => verb(entry)?.passive_participle),
  masadir: chipField((entry) => verb(entry)?.masadir?.[0]?.word),
  verb_form: chipField((entry) =>
    verb(entry)?.form
      ? [verb(entry)?.form, verb(entry)?.form_arabic]
          .filter(Boolean)
          .join(" · ")
      : null
  ),
  huroof: HuroofField,
  root: RootField,
  examples: ExamplesField,
  antonyms: AntonymsField,
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
