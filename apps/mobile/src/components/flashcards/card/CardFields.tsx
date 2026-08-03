import type { CardFieldId } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import * as Sentry from "@sentry/react-native";
import type React from "react";
import type { NativeSyntheticEvent, TextLayoutEventData } from "react-native";
import { Text, View } from "react-native";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations";
import { ExamplesSection } from "./ExamplesSection";
import { HuroofSection } from "./HuroofSection";
import { RootRow } from "./RootRow";
import { ArabicValue, Divider, FieldRow } from "./shared";

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

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View className="rounded-full bg-muted px-2.5 py-0.5">
    <Text className="font-medium text-[12px] text-foreground">{children}</Text>
  </View>
);

/** A translated property (type, gender, inflection) as its own pill. */
const pillField =
  (read: (entry: Entry) => string | null): React.FC<FieldProps> =>
  ({ entry }) => {
    const value = read(entry);

    if (!value) return null;

    return (
      <View className="w-full flex-row flex-wrap justify-center gap-1.5">
        <Pill>{value}</Pill>
      </View>
    );
  };

/** One labelled Arabic value, e.g. the dual or the imperative. */
const rowField =
  (
    read: (entry: Entry) => string | null | undefined,
    label: () => string
  ): React.FC<FieldProps> =>
  ({ entry }) => {
    const value = read(entry);

    if (!value) return null;

    return (
      <View className="w-full">
        <FieldRow label={label()}>
          <ArabicValue>{value}</ArabicValue>
        </FieldRow>
      </View>
    );
  };

const PluralsField: React.FC<FieldProps> = ({ entry }) => {
  const plurals = entry.morphology?.ism?.plurals;

  if (!plurals?.length) return null;

  return (
    <View className="w-full">
      <FieldRow label={t`Plurals`}>
        <View className="flex-row items-center gap-2">
          {plurals.map((plural, index) => (
            <ArabicValue key={plural.word} primary={index === 0}>
              {plural.word}
            </ArabicValue>
          ))}
        </View>
      </FieldRow>
    </View>
  );
};

const MasadirField: React.FC<FieldProps> = ({ entry }) => {
  const masadir = entry.morphology?.verb?.masadir;

  if (!masadir?.length) return null;

  return (
    <View className="w-full">
      <FieldRow label={t`Masdar`}>
        <View className="flex-row items-center gap-2">
          {masadir.map((masdar, index) => (
            <ArabicValue key={masdar.word} primary={index === 0}>
              {masdar.word}
            </ArabicValue>
          ))}
        </View>
      </FieldRow>
    </View>
  );
};

const VerbFormField: React.FC<FieldProps> = ({ entry }) => {
  const verb = entry.morphology?.verb;

  if (!verb?.form) return null;

  return (
    <View className="w-full">
      <FieldRow label={t`Verb form`}>
        <Text className="font-medium text-[14px] text-foreground">
          {verb.form}
        </Text>
        {verb.form_arabic ? (
          <ArabicValue primary={false}>{verb.form_arabic}</ArabicValue>
        ) : null}
      </FieldRow>
    </View>
  );
};

const HuroofField: React.FC<FieldProps> = ({ entry }) => {
  const verb = entry.morphology?.verb;

  if (!verb?.huroof?.length) return null;

  return (
    <>
      <Divider />
      <HuroofSection baseWord={entry.word} verb={verb} />
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

const ism = (entry: Entry) => entry.morphology?.ism;
const verb = (entry: Entry) => entry.morphology?.verb;

const FIELD_RENDERERS: Record<CardFieldId, React.FC<FieldProps>> = {
  tags: TagsField,
  word: WordField,
  translation: TranslationField,
  definition: DefinitionField,
  type: pillField((entry) => {
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
  gender: pillField((entry) => {
    switch (ism(entry)?.gender) {
      case "masculine":
        return t`Masculine`;
      case "feminine":
        return t`Feminine`;
      default:
        return null;
    }
  }),
  inflection: pillField((entry) => {
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
  singular: rowField(
    (entry) => ism(entry)?.singular,
    () => t`Singular`
  ),
  dual: rowField(
    (entry) => ism(entry)?.dual,
    () => t`Dual`
  ),
  plurals: PluralsField,
  past_tense: rowField(
    (entry) => verb(entry)?.past_tense,
    () => t`Past tense`
  ),
  present_tense: rowField(
    (entry) => verb(entry)?.present_tense,
    () => t`Present tense`
  ),
  imperative: rowField(
    (entry) => verb(entry)?.imperative,
    () => t`Imperative`
  ),
  active_participle: rowField(
    (entry) => verb(entry)?.active_participle,
    () => t`Active participle`
  ),
  passive_participle: rowField(
    (entry) => verb(entry)?.passive_participle,
    () => t`Passive participle`
  ),
  masadir: MasadirField,
  verb_form: VerbFormField,
  huroof: HuroofField,
  root: RootField,
  examples: ExamplesField,
  antonyms: AntonymsField,
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
