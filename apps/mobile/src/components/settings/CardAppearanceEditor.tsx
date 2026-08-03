import {
  CARD_FACES,
  type CardFace,
  type CardFieldId,
  type CardLayout,
  hiddenCardFields,
  REQUIRED_FIELD_BY_FACE,
  resolveCardFace,
} from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import * as Sentry from "@sentry/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Eye, EyeOff, GripVertical, Lock, Plus } from "lucide-react-native";
import type React from "react";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { toast } from "sonner-native";
import { FIELD_RENDERERS } from "@/components/flashcards/card/CardFields";
import { dictionaryEntriesTable, settingsTable } from "@/lib/db/operations";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";

const move = <T,>(items: T[], from: number, to: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(from, 1);

  next.splice(to, 0, moved);

  return next;
};

/**
 * The card is the editor: fields render as review renders them, tapping one
 * hides it, and hidden fields stay in place dimmed so adding one back happens
 * where it will appear. Reordering lives behind a long press rather than a pair
 * of arrows on every row.
 */
export const CardAppearanceEditor: React.FC = () => {
  const colors = useThemeColors();
  const [direction, setDirection] = useState<"forward" | "reverse">("forward");
  const [side, setSide] = useState<"question" | "answer">("question");
  const [showHidden, setShowHidden] = useState(true);

  const face: CardFace = `${direction}_${side}`;

  const { data: settings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  const { data: entries } = useQuery({
    queryFn: () => dictionaryEntriesTable.list.query({ limit: 1 }),
    ...dictionaryEntriesTable.list.cacheOptions,
  });

  const entry = entries?.[0];

  const { mutateAsync: updateSettings } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
  });

  const faces = useMemo(
    () =>
      Object.fromEntries(
        CARD_FACES.map((key) => [
          key,
          resolveCardFace({
            layout: settings?.card_layout,
            face: key,
            showAntonyms: settings?.show_antonyms_in_flashcard ?? undefined,
          }),
        ])
      ) as Record<CardFace, CardFieldId[]>,
    [settings]
  );

  const visible = faces[face];
  const hidden = hiddenCardFields(visible);
  const requiredField = REQUIRED_FIELD_BY_FACE[face];

  const fieldLabels: Record<CardFieldId, string> = {
    tags: t`Tags`,
    word: t`Word`,
    translation: t`Translation`,
    definition: t`Definition`,
    type: t`Word type`,
    gender: t`Gender`,
    inflection: t`Inflection`,
    singular: t`Singular`,
    dual: t`Dual`,
    plurals: t`Plural`,
    past_tense: t`Past tense`,
    present_tense: t`Present tense`,
    imperative: t`Imperative`,
    active_participle: t`Active participle`,
    passive_participle: t`Passive participle`,
    masadir: t`Masdar`,
    verb_form: t`Verb form`,
    huroof: t`Huroof`,
    root: t`Root`,
    examples: t`Examples`,
    antonyms: t`Antonyms`,
  };

  // Writes land immediately -- no Save on this screen, so the card in front of
  // you is the card review shows. The toast carries the only escape hatch.
  const commit = async ({
    fields,
    undoLabel,
  }: {
    fields: CardFieldId[];
    undoLabel?: string;
  }) => {
    const previous = visible;

    const layout: CardLayout = {
      version: 1,
      faces: { ...faces, [face]: fields },
    };

    try {
      await updateSettings({ updates: { card_layout: layout } });

      if (undoLabel) {
        toast(undoLabel, {
          action: {
            label: t`Undo`,
            onClick: () => commit({ fields: previous }),
          },
        });
      }
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t`Could not update the card.`);
    }
  };

  const toggle = (field: CardFieldId, isVisible: boolean) => {
    if (field === requiredField) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isVisible) {
      commit({
        fields: visible.filter((item) => item !== field),
        undoLabel: t`${fieldLabels[field]} hidden`,
      });
      return;
    }

    commit({
      fields: [...visible, field],
      undoLabel: t`${fieldLabels[field]} shown`,
    });
  };

  const reorder = (field: CardFieldId) => {
    const index = visible.indexOf(field);

    if (index === -1) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options: { text: string; onPress?: () => void; style?: "cancel" }[] =
      [];

    if (index > 0) {
      options.push({
        text: t`Move up`,
        onPress: () => commit({ fields: move(visible, index, index - 1) }),
      });
    }

    if (index < visible.length - 1) {
      options.push({
        text: t`Move down`,
        onPress: () => commit({ fields: move(visible, index, index + 1) }),
      });
    }

    options.push({ text: t`Cancel`, style: "cancel" });

    Alert.alert(fieldLabels[field], undefined, options);
  };

  const rows = [
    ...visible.map((field) => ({ field, isVisible: true })),
    ...(showHidden ? hidden.map((field) => ({ field, isVisible: false })) : []),
  ];

  const segmented = <T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (next: T) => void;
  }) => (
    <View className="w-full flex-row gap-1 rounded-xl bg-muted p-1">
      {options.map((option) => (
        <Pressable
          className={
            option.value === value
              ? "flex-1 items-center rounded-lg bg-background py-2"
              : "flex-1 items-center rounded-lg py-2"
          }
          key={option.value}
          onPress={() => onChange(option.value)}
        >
          <Text
            className={
              option.value === value
                ? "font-semibold text-foreground text-sm"
                : "font-medium text-muted-foreground text-sm"
            }
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (!entry) {
    return (
      <Text className="text-muted-foreground text-sm">
        <Trans>Add a word to your dictionary to set up your cards.</Trans>
      </Text>
    );
  }

  return (
    <View className="gap-3">
      {segmented({
        value: direction,
        onChange: setDirection,
        options: [
          { value: "forward", label: t`Forward` },
          { value: "reverse", label: t`Reverse` },
        ],
      })}
      {segmented({
        value: side,
        onChange: setSide,
        options: [
          { value: "question", label: t`Question` },
          { value: "answer", label: t`Answer` },
        ],
      })}

      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] text-muted-foreground/70">
          <Trans>Tap a field to hide it · hold to reorder</Trans>
        </Text>
        <Pressable
          className="flex-row items-center gap-1.5 rounded-full bg-muted px-2.5 py-1"
          onPress={() => setShowHidden(!showHidden)}
        >
          {showHidden ? (
            <Eye color={colors.primary} size={13} />
          ) : (
            <EyeOff color={colors.mutedForeground} size={13} />
          )}
          <Text
            className={
              showHidden
                ? "font-medium text-[11px] text-primary"
                : "font-medium text-[11px] text-muted-foreground"
            }
          >
            {showHidden ? (
              <Trans>Hidden shown</Trans>
            ) : (
              <Trans>Hidden off</Trans>
            )}
          </Text>
        </Pressable>
      </View>

      <View className="gap-0.5 rounded-3xl border border-border bg-card p-3">
        {rows.map(({ field, isVisible }) => {
          const Field = FIELD_RENDERERS[field];
          const isRequired = field === requiredField;

          return (
            <Pressable
              className={
                isVisible
                  ? "flex-row items-center gap-2 rounded-2xl px-1.5 py-1.5"
                  : "flex-row items-center gap-2 rounded-2xl border border-border/70 border-dashed px-1.5 py-1.5"
              }
              key={field}
              onLongPress={() => isVisible && reorder(field)}
              onPress={() => toggle(field, isVisible)}
              style={{ opacity: isVisible ? 1 : 0.4 }}
            >
              <View className="w-3.5 items-center">
                {isVisible && !isRequired ? (
                  <GripVertical color={colors.mutedForeground} size={13} />
                ) : null}
              </View>

              <View className="w-full flex-1 items-center gap-1">
                <Field entry={entry} isPrompt={isRequired} />
              </View>

              <View className="w-4 items-center">
                {isRequired ? (
                  <Lock color={colors.mutedForeground} size={11} />
                ) : isVisible ? (
                  <EyeOff color={colors.mutedForeground} size={13} />
                ) : (
                  <Plus color={colors.primary} size={13} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        className="flex-row items-center justify-center gap-1.5 py-1"
        onPress={() =>
          commit({
            fields: resolveCardFace({
              layout: null,
              face,
              showAntonyms: settings?.show_antonyms_in_flashcard ?? undefined,
            }),
            undoLabel: t`This side reset to defaults`,
          })
        }
      >
        <Text className="font-medium text-[11px] text-muted-foreground">
          <Trans>Reset this side to defaults</Trans>
        </Text>
      </Pressable>
    </View>
  );
};
