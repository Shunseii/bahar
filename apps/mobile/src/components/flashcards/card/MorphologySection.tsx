import type { Morphology } from "@bahar/drizzle-user-db-schemas";
import type React from "react";
import { Text, View } from "react-native";
import { ArabicValue, FieldRow, SectionHeader } from "./shared";

interface MorphologySectionProps {
  morphology: Morphology | null | undefined;
}

const hasIsmContent = (ism: NonNullable<Morphology>["ism"]) =>
  Boolean(ism?.singular || ism?.dual || (ism?.plurals?.length ?? 0) > 0);

const hasVerbRowContent = (verb: NonNullable<Morphology>["verb"]) =>
  Boolean(
    verb?.past_tense ||
      verb?.present_tense ||
      verb?.imperative ||
      verb?.active_participle ||
      verb?.passive_participle ||
      (verb?.masadir?.length ?? 0) > 0
  );

export const MorphologySection: React.FC<MorphologySectionProps> = ({
  morphology,
}) => {
  if (!morphology) return null;
  const ism = morphology.ism;
  const verb = morphology.verb;

  if (!hasIsmContent(ism) && !hasVerbRowContent(verb)) return null;

  const verbRows: { label: string; value: string }[] = [];
  if (verb?.past_tense)
    verbRows.push({ label: "Past", value: verb.past_tense });
  if (verb?.present_tense)
    verbRows.push({ label: "Present", value: verb.present_tense });
  if (verb?.imperative)
    verbRows.push({ label: "Imperative", value: verb.imperative });
  if (verb?.active_participle)
    verbRows.push({ label: "Active P.", value: verb.active_participle });
  if (verb?.passive_participle)
    verbRows.push({ label: "Passive P.", value: verb.passive_participle });

  return (
    <View className="w-full gap-2">
      <SectionHeader label="MORPHOLOGY" />

      {ism?.singular && (
        <FieldRow label="Singular">
          <ArabicValue>{ism.singular}</ArabicValue>
        </FieldRow>
      )}
      {ism?.dual && (
        <FieldRow label="Dual">
          <ArabicValue>{ism.dual}</ArabicValue>
        </FieldRow>
      )}
      {ism?.plurals && ism.plurals.length > 0 && (
        <FieldRow label="Plurals">
          <View className="flex-row flex-wrap items-center justify-end gap-1.5">
            {ism.plurals.map((plural, idx) => (
              <View
                className="flex-row items-center gap-1"
                key={`${plural.word}-${idx}`}
              >
                {idx > 0 && (
                  <Text className="text-muted-foreground/60 text-sm">·</Text>
                )}
                <ArabicValue primary={idx === 0}>{plural.word}</ArabicValue>
              </View>
            ))}
          </View>
        </FieldRow>
      )}
      {ism?.plurals?.some((p) => p.details) && (
        <View className="gap-1 pl-1">
          {ism.plurals
            .filter((p) => p.details)
            .map((p, idx) => (
              <Text
                className="text-[11px] text-muted-foreground/80 italic"
                key={`plural-detail-${idx}`}
              >
                {p.word}: {p.details}
              </Text>
            ))}
        </View>
      )}

      {verbRows.map((row) => (
        <FieldRow key={row.label} label={row.label}>
          <ArabicValue>{row.value}</ArabicValue>
        </FieldRow>
      ))}

      {verb?.masadir && verb.masadir.length > 0 && (
        <FieldRow label="Masdar">
          <View className="flex-row flex-wrap items-center justify-end gap-1.5">
            {verb.masadir.map((m, idx) => (
              <View
                className="flex-row items-center gap-1"
                key={`${m.word}-${idx}`}
              >
                {idx > 0 && (
                  <Text className="text-muted-foreground/60 text-sm">·</Text>
                )}
                <ArabicValue primary={idx === 0}>{m.word}</ArabicValue>
              </View>
            ))}
          </View>
        </FieldRow>
      )}
      {verb?.masadir?.some((m) => m.details) && (
        <View className="gap-1 pl-1">
          {verb.masadir
            .filter((m) => m.details)
            .map((m, idx) => (
              <Text
                className="text-[11px] text-muted-foreground/80 italic"
                key={`masdar-detail-${idx}`}
              >
                {m.word}: {m.details}
              </Text>
            ))}
        </View>
      )}
    </View>
  );
};

export default MorphologySection;
