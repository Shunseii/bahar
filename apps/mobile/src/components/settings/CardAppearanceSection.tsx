import {
  CARD_FACES,
  type CardFace,
  type CardFieldId,
  type CardLayout,
  hiddenCardFields,
  REQUIRED_FIELD_BY_FACE,
  resolveCardFace,
} from "@bahar/drizzle-user-db-schemas";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Sentry from "@sentry/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutTemplate,
  Lock,
} from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { toast } from "sonner-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dictionaryEntriesTable, settingsTable } from "@/lib/db/operations";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";
import { CardPreviewModal } from "./CardPreviewModal";

export const CardAppearanceSection: React.FC = () => {
  const { t } = useLingui();
  const colors = useThemeColors();
  const [selectedFace, setSelectedFace] =
    useState<CardFace>("forward_question");
  const [draft, setDraft] = useState<Record<CardFace, CardFieldId[]> | null>(
    null
  );
  const [previewDirection, setPreviewDirection] = useState<
    "forward" | "reverse" | null
  >(null);

  const { data: settings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  const { data: entries } = useQuery({
    queryFn: () => dictionaryEntriesTable.list.query({ limit: 1 }),
    ...dictionaryEntriesTable.list.cacheOptions,
  });

  const { mutateAsync: updateSettings, isPending } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
  });

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

  const faceLabels: Record<CardFace, string> = {
    forward_question: t`Forward · question`,
    forward_answer: t`Forward · answer`,
    reverse_question: t`Reverse · question`,
    reverse_answer: t`Reverse · answer`,
  };

  // The editor always works on all four faces so a save writes every one of
  // them, including the faces the user never opened.
  const faces =
    draft ??
    (Object.fromEntries(
      CARD_FACES.map((face) => [
        face,
        resolveCardFace({
          layout: settings?.card_layout,
          face,
          showAntonyms: settings?.show_antonyms_in_flashcard ?? undefined,
        }),
      ])
    ) as Record<CardFace, CardFieldId[]>);

  const layout: CardLayout = { version: 1, faces };
  const visible = faces[selectedFace];
  const hidden = hiddenCardFields(visible);
  const requiredField = REQUIRED_FIELD_BY_FACE[selectedFace];
  const isDirty = draft !== null;

  const setFace = (fields: CardFieldId[]) =>
    setDraft({ ...faces, [selectedFace]: fields });

  const move = (index: number, offset: number) => {
    const next = [...visible];
    const target = index + offset;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    setFace(next);
  };

  const save = async () => {
    try {
      await updateSettings({ updates: { card_layout: layout } });
      setDraft(null);
      toast.success(t`Card layout saved.`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t`Could not save the card layout.`);
    }
  };

  const resetToDefaults = async () => {
    try {
      await updateSettings({ updates: { card_layout: null } });
      setDraft(null);
      toast.success(t`Card layout reset to the defaults.`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t`Could not reset the card layout.`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <LayoutTemplate color={colors.mutedForeground} size={18} />
          <CardTitle>
            <Trans>Card appearance</Trans>
          </CardTitle>
        </View>
      </CardHeader>

      <CardContent className="gap-4">
        <Text className="text-muted-foreground text-sm">
          <Trans>
            Pick which fields show on each side of your cards, and in what
            order.
          </Trans>
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {CARD_FACES.map((face) => (
            <Pressable
              className={
                face === selectedFace
                  ? "rounded-full bg-primary px-3 py-1.5"
                  : "rounded-full bg-muted px-3 py-1.5"
              }
              key={face}
              onPress={() => setSelectedFace(face)}
            >
              <Text
                className={
                  face === selectedFace
                    ? "font-medium text-primary-foreground text-xs"
                    : "font-medium text-muted-foreground text-xs"
                }
              >
                {faceLabels[face]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="gap-2">
          {visible.map((field, index) => (
            <View
              className="flex-row items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2"
              key={field}
            >
              <View className="gap-0.5">
                <Pressable
                  accessibilityLabel={t`Move up`}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                >
                  <ArrowUp
                    color={
                      index === 0 ? colors.mutedForeground : colors.foreground
                    }
                    size={14}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel={t`Move down`}
                  disabled={index === visible.length - 1}
                  onPress={() => move(index, 1)}
                >
                  <ArrowDown
                    color={
                      index === visible.length - 1
                        ? colors.mutedForeground
                        : colors.foreground
                    }
                    size={14}
                  />
                </Pressable>
              </View>

              <Text className="flex-1 text-foreground text-sm">
                {fieldLabels[field]}
              </Text>

              {field === requiredField ? (
                <View className="flex-row items-center gap-1">
                  <Lock color={colors.mutedForeground} size={12} />
                  <Text className="text-[11px] text-muted-foreground">
                    <Trans>Always shown</Trans>
                  </Text>
                </View>
              ) : (
                <Pressable
                  accessibilityLabel={t`Hide field`}
                  onPress={() =>
                    setFace(visible.filter((item) => item !== field))
                  }
                >
                  <EyeOff color={colors.mutedForeground} size={16} />
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {hidden.length > 0 && (
          <View className="gap-2">
            <Text className="font-medium text-[11px] text-muted-foreground uppercase">
              <Trans>Hidden on this side</Trans>
            </Text>

            {hidden.map((field) => (
              <View
                className="flex-row items-center gap-2 rounded-xl border border-border/50 px-3 py-2"
                key={field}
              >
                <Text className="flex-1 text-muted-foreground text-sm">
                  {fieldLabels[field]}
                </Text>
                <Pressable
                  accessibilityLabel={t`Show field`}
                  onPress={() => setFace([...visible, field])}
                >
                  <Eye color={colors.mutedForeground} size={16} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View className="gap-2">
          <Button disabled={!isDirty || isPending} onPress={save}>
            <Text className="font-medium text-primary-foreground">
              <Trans>Save changes</Trans>
            </Text>
          </Button>
          <Button
            disabled={isPending}
            onPress={resetToDefaults}
            variant="ghost"
          >
            <Text className="font-medium text-muted-foreground">
              <Trans>Reset to defaults</Trans>
            </Text>
          </Button>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                onPress={() => setPreviewDirection("forward")}
                variant="outline"
              >
                <Text className="font-medium text-foreground text-sm">
                  <Trans>Preview forward</Trans>
                </Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button
                onPress={() => setPreviewDirection("reverse")}
                variant="outline"
              >
                <Text className="font-medium text-foreground text-sm">
                  <Trans>Preview reverse</Trans>
                </Text>
              </Button>
            </View>
          </View>
        </View>

        {isDirty && (
          <Text className="text-[11px] text-muted-foreground">
            <Trans>
              Unsaved changes. The preview already reflects them; your cards do
              not until you save.
            </Trans>
          </Text>
        )}
      </CardContent>

      <CardPreviewModal
        direction={previewDirection}
        entry={entries?.[0] ?? null}
        layoutOverride={layout}
        onClose={() => setPreviewDirection(null)}
      />
    </Card>
  );
};
