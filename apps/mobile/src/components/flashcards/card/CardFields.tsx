import type { CardFieldId } from "@bahar/drizzle-user-db-schemas";
import * as Sentry from "@sentry/react-native";
import type React from "react";
import type { NativeSyntheticEvent, TextLayoutEventData } from "react-native";
import { Text, View } from "react-native";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations";
import { ExamplesSection } from "./ExamplesSection";
import { HuroofSection } from "./HuroofSection";
import { MorphologySection } from "./MorphologySection";
import { PropertiesRow } from "./PropertiesRow";
import { RootRow } from "./RootRow";
import { Divider } from "./shared";

type Entry = FlashcardWithDictionaryEntry["dictionary_entry"];

/**
 * TEMPORARY DIAGNOSTIC (translation truncation on the answer side).
 *
 * onTextLayout reports the lines RN actually laid out, so joining their text
 * back together and comparing it to the source string says whether the
 * truncation happens at layout time or before the string ever reaches here.
 */
const logTranslationTextLayout = ({
  entry,
  event,
}: {
  entry: Entry;
  event: NativeSyntheticEvent<TextLayoutEventData>;
}) => {
  const { lines } = event.nativeEvent;
  const laidOutText = lines.map((line) => line.text).join("");

  Sentry.logger.info("flashcard.answer.translationTextLayout", {
    operation: "flashcard.translationTruncation",
    entryId: entry.id,
    word: entry.word,
    sourceText: JSON.stringify(entry.translation),
    sourceLength: entry.translation.length,
    laidOutText: JSON.stringify(laidOutText),
    laidOutLength: laidOutText.length,
    droppedCharacters: entry.translation.length - laidOutText.length,
    lineCount: lines.length,
    lineWidths: lines.map((line) => Math.round(line.width)),
    lineHeights: lines.map((line) => Math.round(line.height)),
  });
};

export const TagsRow: React.FC<{ tags: string[] }> = ({ tags }) => {
  if (tags.length === 0) return null;

  return (
    <View className="w-full flex-row flex-wrap justify-center gap-1.5">
      {tags.map((tag) => (
        <View className="rounded-full bg-muted px-2.5 py-0.5" key={tag}>
          <Text className="text-[11px] text-muted-foreground">{tag}</Text>
        </View>
      ))}
    </View>
  );
};

const hasMorphology = (entry: Entry) => {
  const ism = entry.morphology?.ism;
  const verb = entry.morphology?.verb;

  return Boolean(
    ism?.singular ||
      ism?.dual ||
      (ism?.plurals?.length ?? 0) > 0 ||
      verb?.past_tense ||
      verb?.present_tense ||
      verb?.imperative ||
      verb?.active_participle ||
      verb?.passive_participle ||
      (verb?.masadir?.length ?? 0) > 0
  );
};

type FieldProps = {
  entry: Entry;
  /** The field the face leads with, which renders at prompt size. */
  isPrompt: boolean;
};

/* w-full is load-bearing, not cosmetic. The parent centers its children
   (items-center), so without an explicit width this box is content-sized: its
   height gets measured from the text at its *unconstrained* width, which never
   wraps and so reports a single line. The box then lays out at the card's
   narrower width, the text wraps to two lines, and the height is already
   committed one line short -- the overflow is clipped by the card's
   overflow-hidden, silently dropping part of the translation. */
const WordField: React.FC<FieldProps> = ({ entry, isPrompt }) => (
  <Text
    className={
      isPrompt
        ? "w-full text-center font-bold text-4xl text-foreground leading-relaxed"
        : "w-full text-center font-bold text-3xl text-foreground leading-relaxed"
    }
    style={{ writingDirection: "rtl" }}
  >
    {entry.word}
  </Text>
);

const TranslationField: React.FC<FieldProps> = ({ entry, isPrompt }) => (
  <Text
    className={
      isPrompt
        ? "w-full text-center font-bold text-3xl text-foreground leading-relaxed"
        : "w-full text-center font-medium text-foreground text-xl"
    }
    onTextLayout={(event) => logTranslationTextLayout({ entry, event })}
  >
    {entry.translation}
  </Text>
);

const DefinitionField: React.FC<FieldProps> = ({ entry }) => {
  if (!entry.definition) return null;

  return (
    <Text className="w-full text-center text-[13px] text-muted-foreground">
      {entry.definition}
    </Text>
  );
};

/**
 * Everything the entry knows about the word's form: its type and gender pills,
 * the singular/dual/plural table, and a verb's huroof.
 */
const MorphologyField: React.FC<FieldProps> = ({ entry }) => {
  const verb = entry.morphology?.verb;

  return (
    <>
      <PropertiesRow morphology={entry.morphology} type={entry.type} />
      {hasMorphology(entry) && (
        <>
          <Divider />
          <MorphologySection morphology={entry.morphology} />
        </>
      )}
      {!!verb?.huroof?.length && (
        <>
          <Divider />
          <HuroofSection baseWord={entry.word} verb={verb} />
        </>
      )}
    </>
  );
};

const RootField: React.FC<FieldProps> = ({ entry }) => {
  if (!entry.root?.length) return null;

  return (
    <>
      <Divider />
      <RootRow root={entry.root} />
    </>
  );
};

const ExamplesField: React.FC<FieldProps> = ({ entry }) => {
  if (!entry.examples?.length) return null;

  return (
    <>
      <Divider />
      <ExamplesSection examples={entry.examples} />
    </>
  );
};

const AntonymsField: React.FC<FieldProps> = ({ entry }) => {
  if (!entry.antonyms?.length) return null;

  return (
    <Text
      className="w-full text-center text-[13px] text-muted-foreground"
      style={{ writingDirection: "rtl" }}
    >
      أضداد: {entry.antonyms.map((antonym) => antonym.word).join("، ")}
    </Text>
  );
};

const TagsField: React.FC<FieldProps> = ({ entry }) => (
  <TagsRow tags={entry.tags ?? []} />
);

const FIELD_RENDERERS: Record<CardFieldId, React.FC<FieldProps>> = {
  word: WordField,
  translation: TranslationField,
  definition: DefinitionField,
  morphology: MorphologyField,
  root: RootField,
  examples: ExamplesField,
  antonyms: AntonymsField,
  tags: TagsField,
};

/**
 * Renders a card face's fields in the user's configured order.
 */
export const CardFields: React.FC<{
  entry: Entry;
  fields: CardFieldId[];
  promptField: CardFieldId;
}> = ({ entry, fields, promptField }) => (
  <>
    {fields.map((field) => {
      const Field = FIELD_RENDERERS[field];

      return (
        <Field entry={entry} isPrompt={field === promptField} key={field} />
      );
    })}
  </>
);
